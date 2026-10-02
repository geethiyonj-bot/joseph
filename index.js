const crypto = require("crypto");
const MODEL = process.env.OPENAI_MODEL || "gpt-6-astra";
const MAX_BODY = 10 * 1024 * 1024;
const rate = new Map();

const LIBRARY = {
  CSE:["Microcontroller","Microprocessor","CPU","GPU","FPGA","PLC","RAM","ROM","SSD","Camera Module","AI Accelerator","Wi-Fi Module","Bluetooth Module","Sensor Node","Display","Servo Controller"],
  EEE:["Resistor","Potentiometer","Thermistor","Capacitor","Electrolytic Capacitor","Ceramic Capacitor","Inductor","Transformer","Diode","Zener Diode","Schottky Diode","LED","BJT","MOSFET","IGBT","Relay","Contactor","Op-Amp","Motor","DC Motor","BLDC Motor","Stepper Motor","Generator","Alternator","Battery","Power Supply","Fuse","Circuit Breaker","Current Sensor","Voltage Sensor"],
  ECE:["AND Gate","OR Gate","NOT Gate","NAND Gate","NOR Gate","XOR Gate","Flip-Flop","Counter","Register","Multiplexer","ADC","DAC","Comparator","Oscillator","Crystal","Antenna","RF Module","PLL","PCB","Transceiver","UART","SPI","I2C","CAN","Ethernet"],
  FT:["Pump","Valve","Pipe","Reservoir","Heat Exchanger","Flow Meter","Pressure Sensor","Nozzle","Mixer","Filter","Reactor","Condenser","Compressor","Tank"],
  CIVIL:["Beam","Column","Slab","Foundation","Footing","Bridge Joint","Road","Pipeline","Water Tank","Dam","Crane","Concrete Block","Rebar","Truss","Girder","Tunnel","Drainage","Manhole","Sewer","Retaining Wall","Pile"],
  MECH:["Gear","Shaft","Bearing","Spring","Damper","Piston","Cylinder","Hydraulic Cylinder","Pump","Compressor","Turbine","Fan","Flywheel","Brake","Clutch","Coupling","Pulley","Belt","Chain","Actuator","Linear Actuator","Robot Arm","Gripper","Frame","Chassis","Heat Sink","Heat Exchanger"],
  AUTOMOBILE:["Engine","Transmission","Differential","Wheel","Tire","Brake","Suspension","Radiator","Fuel Tank","Battery","ECU","Alternator","Starter Motor","Exhaust","Catalytic Converter","Steering Rack","Air Filter","Fuel Injector","Turbocharger","Intercooler","Clutch","Drive Shaft","Chassis","ABS Sensor","Oxygen Sensor"],
  AEROSPACE:["Airframe","Wing","Aileron","Elevator","Rudder","Flap","Slat","Jet Engine","Turbofan","Fuel Tank","Landing Gear","Avionics","Radar","Propeller","Flight Computer","GPS","IMU","Pitot Tube","Cabin","Payload Bay","Control Surface"],
  SPACECRAFT:["Payload","Solar Array","Battery","Thruster","Reaction Wheel","Star Tracker","Telemetry","Antenna","Fuel Tank","Docking Port","Flight Computer","IMU","Thermal Radiator","Heat Shield","Structure","Propulsion Module"],
  FLUID:["Pipe","Pump","Valve","Check Valve","Pressure Regulator","Reservoir","Tank","Nozzle","Venturi","Flow Meter","Pressure Sensor","Filter","Heat Exchanger","Compressor","Turbine"],
  SCIENCE:["Mass","Spring","Pendulum","Magnet","Electroscope","Heat Source","Lens","Prism","Particle Source","Light Source","Thermometer","Pressure Gauge","Force Sensor","Motion Sensor","Oscilloscope"],
  CHEMISTRY:["Reactor","Mixer","Beaker","Flask","Heat Bath","Condenser","Distillation Column","pH Sensor","Gas Line","Valve","Filter","Separator","Pump","Temperature Probe","Pressure Vessel"],
  BIOLOGY:["Cell Model","Incubator","Microscope","Culture Vessel","Sensor","Pump","Filter","Centrifuge","Petri Dish","DNA Model","Bioreactor","Flow Chamber"],
  NANOTECH:["Nanowire","Nanotube","Thin Film","MEMS Sensor","Nanoelectrode","Microfluidic Channel","Nanoparticle Source","AFM Tip","Nanoheater","Graphene Sheet"],
  QUANTUM:["Qubit","Quantum Gate","Hadamard Gate","CNOT Gate","Cryogenic Stage","Photon Source","Detector","Readout","Quantum Register","Superconducting Loop"],
  ROBOTICS:["Robot Base","Servo","Joint","Encoder","IMU","LiDAR","Depth Camera","Gripper","Controller","Motor Driver","Force Sensor"],
  RENEWABLE:["Solar Cell","PV Array","Wind Turbine","Generator","Inverter","Battery Bank","Charge Controller","Hydrogen Tank","Fuel Cell","Electrolyzer"]
};

const ACTION_TYPES = ["add","remove","move","rotate","connect","disconnect","split","fix","run","check","showall","zoom","pan","center","duplicate","align","measure","reset","color"];
const ACTION_SCHEMA = {
  type:"object", additionalProperties:false,
  properties:{
    reply:{type:"string"},
    actions:{type:"array",items:{type:"object",additionalProperties:false,properties:{
      type:{type:"string",enum:ACTION_TYPES},
      name:{type:["string","null"]}, target:{type:["string","null"]}, source:{type:["string","null"]},
      department:{type:["string","null"]}, shape:{type:["string","null"]},
      x:{type:["number","null"]}, y:{type:["number","null"]}, angle:{type:["number","null"]}, value:{type:["number","null"]}, color:{type:["string","null"]}
    },required:["type","name","target","source","department","shape","x","y","angle","value"]}}
  },
  required:["reply","actions"]
};

const SYSTEM = `You are DAVID_AI's engineering design control layer. Convert natural-language, typed, or transcribed voice commands into deterministic visual design actions. You are not a CAD solver and must never claim physical verification.

The browser renders actual engineering-style symbols rather than generic component boxes. For a new system, use realistic components from the library and connect them logically. If the user asks for components from multiple departments, include the requested departments and make explicit connections. For “connect X to Y”, always emit a connect action with source and target. For “connect the motor to the controller”, use the exact component names you created. For “import”, treat it as add. For “draw/model/create a car/engine/etc.”, create a useful set of subsystem components and connections.

Allowed actions: ${ACTION_TYPES.join(", ")}. color: target/name identifies a component and color is a CSS hex colour such as #53c7ff. For colour commands always emit a color action. For split commands always emit split.
add: name is component name; department is library department; shape is an optional visual family such as motor, gear, shaft, battery, controller, pipe, pump, car, aircraft, beam, sensor, generic. x/y are canvas coordinates when useful.
connect: source and target are exact component names. The frontend also supports manual port-to-port and component-to-component connection.
remove: target/name identifies the component. move/rotate/fix/split/duplicate use target or name. split creates editable child parts. check validates the graph conceptually. run starts the conceptual simulation. reset clears the model. showall/center fit the model.

Library:\n${JSON.stringify(LIBRARY)}`;

function json(res,status,payload){
  res.statusCode=status;
  const headers={
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store, no-cache, must-revalidate",
    "pragma":"no-cache",
    "x-content-type-options":"nosniff",
    "x-frame-options":"DENY",
    "referrer-policy":"no-referrer",
    "permissions-policy":"camera=(self), microphone=(self)"
  };
  for(const [k,v] of Object.entries(headers)) res.setHeader(k,v);
  res.end(JSON.stringify(payload));
}
function safeTimingEqual(a,b){
  const aa=Buffer.from(String(a)); const bb=Buffer.from(String(b));
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function sessionSecret(){
  const key=String(process.env.OPENAI_API_KEY||"");
  return String(process.env.DAVID_SESSION_SECRET||key||"david-local-session-secret");
}
function makeSession(){
  const exp=Math.floor(Date.now()/1000)+3600;
  const payload=Buffer.from(JSON.stringify({v:1,exp})).toString("base64url");
  const sig=crypto.createHmac("sha256",sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function validSession(req){
  const raw=String(req.headers.cookie||"");
  const m=raw.match(/(?:^|;\s*)DAVID_SESSION=([^;]+)/);
  if(!m)return false;
  const [payload,sig]=String(m[1]).split(".");
  if(!payload||!sig)return false;
  const expected=crypto.createHmac("sha256",sessionSecret()).update(payload).digest("base64url");
  if(!safeTimingEqual(sig,expected))return false;
  try{const d=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));return Number(d.exp)>Math.floor(Date.now()/1000);}catch{return false;}
}
function sameOrigin(req){
  const origin=String(req.headers.origin||"");
  if(!origin)return true;
  const host=String(req.headers.host||"");
  try{return new URL(origin).host===host;}catch{return false;}
}
function setSessionCookie(res,req){
  const secure=String(req.headers["x-forwarded-proto"]||"").includes("https")||process.env.VERCEL=== "1";
  const parts=[`DAVID_SESSION=${makeSession()}`,"Path=/","HttpOnly","SameSite=Strict","Max-Age=3600"];
  if(secure)parts.push("Secure");
  res.setHeader("Set-Cookie",parts.join("; "));
}

function rateOK(ip){
  const now=Date.now(); const old=rate.get(ip);
  if(!old || now-old.t>60000){rate.set(ip,{t:now,n:1});return true;}
  old.n++; return old.n<=30;
}
async function body(req){
  if(req.body) return typeof req.body==="string"?JSON.parse(req.body):req.body;
  let chunks=[],size=0;
  for await(const c of req){size+=c.length;if(size>MAX_BODY)throw Error("Request too large");chunks.push(c);}
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

module.exports = async (req,res)=>{
  res.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.openai.com https://cdn.jsdelivr.net https://storage.googleapis.com; worker-src 'self' blob:; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if(req.method==="GET"){setSessionCookie(res,req);return json(res,200,{ok:true,service:"DAVID_AI",privacy:"local-first",remoteAI:"optional"});}
  if(req.method!=="POST") return json(res,405,{error:"Method not allowed"});
  if(!sameOrigin(req)) return json(res,403,{error:"Cross-origin request blocked."});
  if(!validSession(req)) return json(res,403,{error:"Secure session required. Reload DAVID and try again."});
  const ip=String(req.headers["x-forwarded-for"]||req.socket?.remoteAddress||"unknown").split(",")[0].trim();
  if(!rateOK(ip)) return json(res,429,{error:"Too many requests. Please wait a moment."});
  let b;
  try{b=await body(req);}catch(e){return json(res,400,{error:e.message||"Invalid JSON"});}
  if(b.audioBase64){
    const raw=String(b.audioBase64);
    if(raw.length>8500000) return json(res,413,{error:"Audio recording is too large."});
    if(!process.env.OPENAI_API_KEY) return json(res,503,{error:"OPENAI_API_KEY is not configured in this Vercel deployment."});
    try{
      const bytes=Buffer.from(raw,"base64");
      const form=new FormData();
      form.append("file",new Blob([bytes],{type:String(b.audioType||"audio/webm")}),"voice.webm");
      form.append("model",process.env.OPENAI_TRANSCRIBE_MODEL||"gpt-transcribe");
      form.append("response_format","json");
      const rr=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form});
      const dd=await rr.json().catch(()=>({}));
      if(!rr.ok) return json(res,502,{error:"Voice transcription service unavailable."});
      return json(res,200,{text:String(dd.text||"")});
    }catch(e){return json(res,500,{error:"Voice transcription failed."});}
  }
  const prompt=String(b.prompt||"").trim();
  if(!prompt) return json(res,400,{error:"Empty prompt"});
  if(prompt.length>8000) return json(res,413,{error:"Prompt too long"});
  if(!process.env.OPENAI_API_KEY) return json(res,503,{error:"OPENAI_API_KEY is not configured in this Vercel deployment. Add it to this project and redeploy."});
  const state=JSON.stringify(b.state||{}).slice(0,14000);
  const input=`CURRENT PROJECT STATE:\n${state}\n\nUSER COMMAND:\n${prompt}`;
  try{
    const r=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"content-type":"application/json"},
      body:JSON.stringify({
        model:MODEL,
        instructions:SYSTEM,
        input:[{role:"user",content:input}],
        tools:[{type:"function",name:"design_actions",description:"Return the visual engineering actions required by the user's command.",strict:true,parameters:ACTION_SCHEMA}],
        tool_choice:{type:"function",name:"design_actions"},
        store:false,
        max_output_tokens:3000
      })
    });
    if(!r.ok){await r.text().catch(()=>"");return json(res,502,{error:"AI service unavailable."});}
    const data=await r.json();
    const call=(data.output||[]).find(x=>x.type==="function_call" && x.name==="design_actions");
    if(!call) return json(res,200,{reply:data.output_text||"No design action was returned.",actions:[]});
    let out;
    try{out=JSON.parse(call.arguments);}catch{ return json(res,502,{error:"AI returned invalid structured actions."}); }
    out.actions=Array.isArray(out.actions)?out.actions.slice(0,80):[];
    return json(res,200,out);
  }catch(e){
    return json(res,500,{error:"Secure AI request failed."});
  }
};
