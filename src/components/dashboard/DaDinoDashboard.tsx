"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, CloudRain, LogOut, MapPinned, Search, Trash2, Users, Utensils, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { saveReservations, loadReservations } from "@/lib/storage";
import { getCurrentUserRole } from "@/lib/auth";

type Area = "sala" | "saletta" | "dehor" | "marciapiede" | "esterno";
type Weather = "normale" | "rischio" | "pioggia";
type Service = "pranzo" | "cena";
type Risk = "basso" | "medio" | "alto";
type Awning = "aperte" | "chiuse";
type Consumption = "pinsa" | "cucina" | "misto" | "non_so";
type Category = "normale" | "affezionato" | "molto_importante";
type Status = "confermata" | "arrivato" | "seduto" | "in_uscita" | "pagato" | "liberato" | "no_show";
type MapTurn = "tutto" | "primo" | "secondo" | "fuori";
type BookingMode = "prenotazione" | "passaggio";

type TableModule = { id:string; area:Area; label:string; seats:number; size:"70x70"|"60x60"; strategicGroup:string; canHeadSeat:boolean };
type TableOption = { id:string; label:string; area:Area; moduleIds:string[]; standardSeats:number; maxAdults:number; maxWithHighchairs:number; comfort:"comodo"|"normale"|"stretto"|"molto_stretto"; strategicCost:number; preservesLargeTables:number; requiresOpenAwning?:boolean; takesExtraDehor2?:boolean; manual?:boolean; notes:string };
type Reservation = { id:number; date:string; name:string; phone:string; time:string; adults:number; highchairs:number; category:Category; areaPreference:Area|"nessuna"; table:string; optionId:string; moduleIds:string[]; status:Status; consumption:Consumption; notes:string; seatedAt?:number; mode:BookingMode; suggestedWaitMinutes?:number };
type Customer = { id:number; name:string; phone:string; category:Category; notes:string; visits:number; lastVisit:string };
type Settings = { service:Service; weather:Weather; risk:Risk; awning:Awning; resetMinutes:number; pinsaPct:number; kitchenPct:number; maxUsefulWait:number };
type FormState = { name:string; phone:string; time:string; adults:number; highchairs:number; category:Category; areaPreference:Area|"nessuna"; consumption:Consumption; notes:string };
type ScoredOption = TableOption & { score:number; warnings:string[]; reasons:string[]; detailedReason:string; turn:string; estimatedEnd:string; resetEnd:string; duration:number; availabilityMessage:string; passageMessage:string; waitMinutes:number; suggestedStart:string; isWaitOption:boolean };

const AREAS: Area[] = ["sala", "saletta", "dehor", "marciapiede", "esterno"];
function todayISO(){return new Date().toISOString().slice(0,10)}
function toMin(t:string){const [h,m]=t.split(":").map(Number);return h*60+m}
function fromMin(v:number){return `${String(Math.floor(v/60)).padStart(2,"0")}:${String(v%60).padStart(2,"0")}`}
function duration(c:Consumption,s:Settings){if(c==="pinsa")return 75;if(c==="cucina")return 105;if(c==="misto")return 90;return Math.round((s.pinsaPct/100)*75+(s.kitchenPct/100)*105)}
function getTurn(time:string,service:Service){if(service==="pranzo")return "pranzo";const m=toMin(time);if(m>=toMin("21:00"))return "secondo turno";if(m>=toMin("20:00"))return "fuori turno";return "primo turno"}
function times(r:{time:string;consumption:Consumption},s:Settings){const start=toMin(r.time);const dur=duration(r.consumption,s);return{start,end:start+dur,resetEnd:start+dur+s.resetMinutes,dur}}
function overlap(a:number,b:number,c:number,d:number){return a<d&&c<b}
function isActiveStatus(status:Status){return !["liberato","no_show"].includes(status)}
function statusClass(status:Status){if(status==="confermata")return"bg-yellow-100 text-yellow-900";if(status==="arrivato")return"bg-green-100 text-green-900";if(status==="seduto")return"bg-blue-100 text-blue-900";if(status==="in_uscita")return"bg-purple-100 text-purple-900";if(status==="pagato")return"bg-gray-100 text-gray-900";if(status==="no_show")return"bg-red-100 text-red-900";return"bg-gray-100 text-gray-900"}

const modules:TableModule[]=[
{id:"sala-1a",area:"sala",label:"1 sala A",seats:2,size:"70x70",strategicGroup:"sala-left",canHeadSeat:true},{id:"sala-1b",area:"sala",label:"1 sala B",seats:2,size:"70x70",strategicGroup:"sala-left",canHeadSeat:true},{id:"sala-2",area:"sala",label:"2 sala",seats:2,size:"70x70",strategicGroup:"sala-left",canHeadSeat:true},{id:"sala-3",area:"sala",label:"3 sala",seats:2,size:"70x70",strategicGroup:"sala-left",canHeadSeat:true},{id:"sala-4",area:"sala",label:"4 sala",seats:2,size:"70x70",strategicGroup:"sala-left",canHeadSeat:true},
{id:"sala-5a",area:"sala",label:"5 sala A",seats:2,size:"70x70",strategicGroup:"sala-right",canHeadSeat:true},{id:"sala-5b",area:"sala",label:"5 sala B",seats:2,size:"70x70",strategicGroup:"sala-right",canHeadSeat:true},{id:"sala-6a",area:"sala",label:"6 sala A",seats:2,size:"70x70",strategicGroup:"sala-right",canHeadSeat:false},{id:"sala-6b",area:"sala",label:"6 sala B",seats:2,size:"70x70",strategicGroup:"sala-right",canHeadSeat:false},{id:"sala-6c",area:"sala",label:"6 sala C",seats:2,size:"70x70",strategicGroup:"sala-right",canHeadSeat:false},
{id:"saletta-1a",area:"saletta",label:"1 saletta A",seats:2,size:"70x70",strategicGroup:"saletta-1",canHeadSeat:true},{id:"saletta-1b",area:"saletta",label:"1 saletta B",seats:2,size:"70x70",strategicGroup:"saletta-1",canHeadSeat:true},{id:"saletta-2a",area:"saletta",label:"2 saletta A",seats:2,size:"70x70",strategicGroup:"saletta-23",canHeadSeat:true},{id:"saletta-2b",area:"saletta",label:"2 saletta B",seats:2,size:"70x70",strategicGroup:"saletta-23",canHeadSeat:true},{id:"saletta-3a",area:"saletta",label:"3 saletta A",seats:2,size:"70x70",strategicGroup:"saletta-23",canHeadSeat:true},{id:"saletta-3b",area:"saletta",label:"3 saletta B",seats:2,size:"70x70",strategicGroup:"saletta-23",canHeadSeat:true},{id:"saletta-4a",area:"saletta",label:"4 saletta A",seats:2,size:"70x70",strategicGroup:"saletta-4",canHeadSeat:true},{id:"saletta-4b",area:"saletta",label:"4 saletta B",seats:2,size:"70x70",strategicGroup:"saletta-4",canHeadSeat:true},
...Array.from({length:15},(_,i)=>({id:`esterno-${i+1}`,area:"esterno" as Area,label:`${i+1} esterno`,seats:2,size:"70x70" as const,strategicGroup:i<5?"esterno-A":i<10?"esterno-B":"esterno-C",canHeadSeat:true})),
...[1,2,3,9,10].map(n=>({id:`dehor-${n}`,area:"dehor" as Area,label:`${n} dehor`,seats:2,size:"60x60" as const,strategicGroup:`dehor-${n}`,canHeadSeat:false})),
...[4,5,6,7,8].flatMap(n=>[{id:`dehor-${n}a`,area:"dehor" as Area,label:`${n} dehor A`,seats:2,size:"60x60" as const,strategicGroup:`dehor-${n}`,canHeadSeat:false},{id:`dehor-${n}b`,area:"dehor" as Area,label:`${n} dehor B`,seats:2,size:"60x60" as const,strategicGroup:`dehor-${n}`,canHeadSeat:false}]),
...[11,12,13,14,15].map(n=>({id:`marciapiede-${n}`,area:"marciapiede" as Area,label:`${n} marciapiede`,seats:2,size:"70x70" as const,strategicGroup:"marciapiede",canHeadSeat:true}))
];

const options: TableOption[] = [
  {id:"sala-1",label:"1 sala",area:"sala",moduleIds:["sala-1a","sala-1b"],standardSeats:4,maxAdults:5,maxWithHighchairs:5,comfort:"normale",strategicCost:4,preservesLargeTables:3,notes:"4 comodo, 5 capotavola"},
  {id:"sala-2",label:"2 sala",area:"sala",moduleIds:["sala-2"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:4,manual:true,notes:"Tavolo 2 sala usabile singolo"},
  {id:"sala-1-2",label:"1+2 sala",area:"sala",moduleIds:["sala-1a","sala-1b","sala-2"],standardSeats:6,maxAdults:7,maxWithHighchairs:7,comfort:"stretto",strategicCost:8,preservesLargeTables:1,manual:true,notes:"6/7, usa parte della tavolata grande"},

  {id:"sala-3",label:"3 sala",area:"sala",moduleIds:["sala-3"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:4,notes:"Tavolo piccolo sala"},
  {id:"sala-4",label:"4 sala",area:"sala",moduleIds:["sala-4"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:4,notes:"Tavolo piccolo sala"},
  {id:"sala-3-4",label:"3+4 sala",area:"sala",moduleIds:["sala-3","sala-4"],standardSeats:4,maxAdults:5,maxWithHighchairs:6,comfort:"normale",strategicCost:4,preservesLargeTables:2,notes:"4/5, possibile 5+1 con vincoli"},

  {id:"sala-1-2-3",label:"1+2+3 sala",area:"sala",moduleIds:["sala-1a","sala-1b","sala-2","sala-3"],standardSeats:8,maxAdults:9,maxWithHighchairs:9,comfort:"stretto",strategicCost:12,preservesLargeTables:0,manual:true,notes:"Tavolata parziale"},
  {id:"sala-1-2-3-4",label:"1+2+3+4 sala",area:"sala",moduleIds:["sala-1a","sala-1b","sala-2","sala-3","sala-4"],standardSeats:12,maxAdults:13,maxWithHighchairs:13,comfort:"stretto",strategicCost:18,preservesLargeTables:0,manual:true,notes:"Tavolata grande sala 12/13"},

  {id:"sala-5",label:"5 sala",area:"sala",moduleIds:["sala-5a","sala-5b"],standardSeats:4,maxAdults:4,maxWithHighchairs:4,comfort:"comodo",strategicCost:3,preservesLargeTables:3,notes:"4 comodo"},
  {id:"sala-5a",label:"5A sala",area:"sala",moduleIds:["sala-5a"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:5,manual:true,notes:"Mezzo tavolo 5 sala usabile singolo"},
  {id:"sala-5b",label:"5B sala",area:"sala",moduleIds:["sala-5b"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:5,manual:true,notes:"Mezzo tavolo 5 sala usabile singolo"},

  {id:"sala-6",label:"6 sala",area:"sala",moduleIds:["sala-6a","sala-6b","sala-6c"],standardSeats:6,maxAdults:6,maxWithHighchairs:7,comfort:"comodo",strategicCost:5,preservesLargeTables:2,notes:"6 adulti, seggiolone possibile"},
  {id:"sala-6a",label:"6A sala",area:"sala",moduleIds:["sala-6a"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:5,manual:true,notes:"Modulo singolo tavolo 6 sala"},
  {id:"sala-6b",label:"6B sala",area:"sala",moduleIds:["sala-6b"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:5,manual:true,notes:"Modulo singolo tavolo 6 sala"},
  {id:"sala-6c",label:"6C sala",area:"sala",moduleIds:["sala-6c"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:5,manual:true,notes:"Modulo singolo tavolo 6 sala"},

  {id:"sala-5-6",label:"5+6 sala",area:"sala",moduleIds:["sala-5a","sala-5b","sala-6a","sala-6b","sala-6c"],standardSeats:10,maxAdults:10,maxWithHighchairs:11,comfort:"normale",strategicCost:14,preservesLargeTables:0,manual:true,notes:"10 o 10+1 seggiolone"},

  {id:"saletta-1",label:"1 saletta",area:"saletta",moduleIds:["saletta-1a","saletta-1b"],standardSeats:4,maxAdults:5,maxWithHighchairs:5,comfort:"stretto",strategicCost:3,preservesLargeTables:3,notes:"4, 5 stretto"},
  {id:"saletta-1a",label:"1A saletta",area:"saletta",moduleIds:["saletta-1a"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:5,manual:true,notes:"Mezzo tavolo 1 saletta usabile singolo"},
  {id:"saletta-1b",label:"1B saletta",area:"saletta",moduleIds:["saletta-1b"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:5,manual:true,notes:"Mezzo tavolo 1 saletta usabile singolo"},

  {id:"saletta-2",label:"2 saletta",area:"saletta",moduleIds:["saletta-2a","saletta-2b"],standardSeats:4,maxAdults:4,maxWithHighchairs:4,comfort:"normale",strategicCost:4,preservesLargeTables:2,notes:"4"},
  {id:"saletta-2a",label:"2A saletta",area:"saletta",moduleIds:["saletta-2a"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:5,manual:true,notes:"Mezzo tavolo 2 saletta usabile singolo"},
  {id:"saletta-2b",label:"2B saletta",area:"saletta",moduleIds:["saletta-2b"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:5,manual:true,notes:"Mezzo tavolo 2 saletta usabile singolo"},

  {id:"saletta-3",label:"3 saletta",area:"saletta",moduleIds:["saletta-3a","saletta-3b"],standardSeats:4,maxAdults:4,maxWithHighchairs:4,comfort:"normale",strategicCost:4,preservesLargeTables:2,notes:"4"},
  {id:"saletta-3a",label:"3A saletta",area:"saletta",moduleIds:["saletta-3a"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:5,manual:true,notes:"Mezzo tavolo 3 saletta usabile singolo"},
  {id:"saletta-3b",label:"3B saletta",area:"saletta",moduleIds:["saletta-3b"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:5,manual:true,notes:"Mezzo tavolo 3 saletta usabile singolo"},

  {id:"saletta-4",label:"4 saletta",area:"saletta",moduleIds:["saletta-4a","saletta-4b"],standardSeats:4,maxAdults:4,maxWithHighchairs:4,comfort:"normale",strategicCost:3,preservesLargeTables:3,notes:"4"},
  {id:"saletta-4a",label:"4A saletta",area:"saletta",moduleIds:["saletta-4a"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:5,manual:true,notes:"Mezzo tavolo 4 saletta usabile singolo"},
  {id:"saletta-4b",label:"4B saletta",area:"saletta",moduleIds:["saletta-4b"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:5,manual:true,notes:"Mezzo tavolo 4 saletta usabile singolo"},

  {id:"saletta-2-3",label:"2+3 saletta",area:"saletta",moduleIds:["saletta-2a","saletta-2b","saletta-3a","saletta-3b"],standardSeats:8,maxAdults:9,maxWithHighchairs:9,comfort:"stretto",strategicCost:10,preservesLargeTables:0,manual:true,notes:"8/9 oppure 6+2 manuale"},

  ...[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(n=>({
    id:`esterno-${n}`,
    label:`${n} esterno`,
    area:"esterno" as Area,
    moduleIds:[`esterno-${n}`],
    standardSeats:2,
    maxAdults:2,
    maxWithHighchairs:3,
    comfort:"normale" as const,
    strategicCost:1,
    preservesLargeTables:6,
    manual:true,
    notes:"Tavolo esterno singolo separabile"
  })),

  {id:"esterno-A-12",label:"Esterno 1+2",area:"esterno",moduleIds:["esterno-1","esterno-2"],standardSeats:4,maxAdults:5,maxWithHighchairs:5,comfort:"comodo",strategicCost:3,preservesLargeTables:4,notes:"4/5 con capotavola"},
  {id:"esterno-A-34",label:"Esterno 3+4",area:"esterno",moduleIds:["esterno-3","esterno-4"],standardSeats:4,maxAdults:5,maxWithHighchairs:5,comfort:"comodo",strategicCost:3,preservesLargeTables:4,notes:"4/5 con capotavola"},
  {id:"esterno-A-123",label:"Esterno 1+2+3",area:"esterno",moduleIds:["esterno-1","esterno-2","esterno-3"],standardSeats:6,maxAdults:7,maxWithHighchairs:7,comfort:"normale",strategicCost:8,preservesLargeTables:2,notes:"6/7"},
  {id:"esterno-A-1234",label:"Esterno 1+2+3+4",area:"esterno",moduleIds:["esterno-1","esterno-2","esterno-3","esterno-4"],standardSeats:8,maxAdults:9,maxWithHighchairs:9,comfort:"normale",strategicCost:12,preservesLargeTables:1,notes:"9 con capotavola"},
  {id:"esterno-A-12345",label:"Esterno 1+2+3+4+5",area:"esterno",moduleIds:["esterno-1","esterno-2","esterno-3","esterno-4","esterno-5"],standardSeats:10,maxAdults:12,maxWithHighchairs:12,comfort:"normale",strategicCost:16,preservesLargeTables:0,manual:true,notes:"11/12 con capotavola"},

  {id:"esterno-B-67",label:"Esterno 6+7",area:"esterno",moduleIds:["esterno-6","esterno-7"],standardSeats:4,maxAdults:6,maxWithHighchairs:6,comfort:"comodo",strategicCost:2,preservesLargeTables:5,notes:"4, capotavola esterni possibili"},
  {id:"esterno-B-89",label:"Esterno 8+9",area:"esterno",moduleIds:["esterno-8","esterno-9"],standardSeats:4,maxAdults:6,maxWithHighchairs:6,comfort:"comodo",strategicCost:2,preservesLargeTables:5,notes:"4, capotavola esterni possibili"},
  {id:"esterno-B-6789",label:"Esterno 6+7+8+9",area:"esterno",moduleIds:["esterno-6","esterno-7","esterno-8","esterno-9"],standardSeats:8,maxAdults:10,maxWithHighchairs:10,comfort:"normale",strategicCost:8,preservesLargeTables:2,notes:"8/10 esterno"},
  {id:"esterno-B-678910",label:"Esterno 6+7+8+9+10",area:"esterno",moduleIds:["esterno-6","esterno-7","esterno-8","esterno-9","esterno-10"],standardSeats:10,maxAdults:12,maxWithHighchairs:12,comfort:"normale",strategicCost:12,preservesLargeTables:0,manual:true,notes:"10/12 esterno"},

  {id:"esterno-C-1112",label:"Esterno 11+12",area:"esterno",moduleIds:["esterno-11","esterno-12"],standardSeats:4,maxAdults:6,maxWithHighchairs:6,comfort:"comodo",strategicCost:2,preservesLargeTables:5,notes:"4, capotavola esterni possibili"},
  {id:"esterno-C-1314",label:"Esterno 13+14",area:"esterno",moduleIds:["esterno-13","esterno-14"],standardSeats:4,maxAdults:6,maxWithHighchairs:6,comfort:"comodo",strategicCost:2,preservesLargeTables:5,notes:"4, capotavola esterni possibili"},
  {id:"esterno-C-11121314",label:"Esterno 11+12+13+14",area:"esterno",moduleIds:["esterno-11","esterno-12","esterno-13","esterno-14"],standardSeats:8,maxAdults:10,maxWithHighchairs:10,comfort:"normale",strategicCost:8,preservesLargeTables:2,notes:"8/10 esterno"},
  {id:"esterno-C-1112131415",label:"Esterno 11+12+13+14+15",area:"esterno",moduleIds:["esterno-11","esterno-12","esterno-13","esterno-14","esterno-15"],standardSeats:10,maxAdults:12,maxWithHighchairs:12,comfort:"normale",strategicCost:12,preservesLargeTables:0,manual:true,notes:"10/12 esterno"},

  ...[11,12,13,14,15].map(n=>({
    id:`marciapiede-${n}`,
    label:`${n} marciapiede`,
    area:"marciapiede" as Area,
    moduleIds:[`marciapiede-${n}`],
    standardSeats:2,
    maxAdults:2,
    maxWithHighchairs:3,
    comfort:"normale" as const,
    strategicCost:1,
    preservesLargeTables:6,
    notes:"2 o 2+1 seggiolone"
  })),

  {id:"dehor-1",label:"1 dehor",area:"dehor",moduleIds:["dehor-1"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:6,manual:true,notes:"Tavolo dehor singolo separabile"},
  {id:"dehor-2",label:"2 dehor",area:"dehor",moduleIds:["dehor-2"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:6,manual:true,notes:"Tavolo dehor singolo separabile"},
  {id:"dehor-3",label:"3 dehor",area:"dehor",moduleIds:["dehor-3"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:6,manual:true,notes:"Tavolo dehor singolo separabile"},
  {id:"dehor-4",label:"4 dehor",area:"dehor",moduleIds:["dehor-4a","dehor-4b"],standardSeats:4,maxAdults:4,maxWithHighchairs:5,comfort:"normale",strategicCost:2,preservesLargeTables:5,manual:true,notes:"Tavolo dehor separabile"},
  {id:"dehor-5",label:"5 dehor",area:"dehor",moduleIds:["dehor-5a","dehor-5b"],standardSeats:4,maxAdults:4,maxWithHighchairs:5,comfort:"normale",strategicCost:2,preservesLargeTables:5,manual:true,notes:"Tavolo dehor separabile"},
  {id:"dehor-6",label:"6 dehor",area:"dehor",moduleIds:["dehor-6a","dehor-6b"],standardSeats:4,maxAdults:4,maxWithHighchairs:5,comfort:"normale",strategicCost:2,preservesLargeTables:5,manual:true,notes:"Tavolo dehor separabile"},
  {id:"dehor-7",label:"7 dehor",area:"dehor",moduleIds:["dehor-7a","dehor-7b"],standardSeats:4,maxAdults:4,maxWithHighchairs:5,comfort:"normale",strategicCost:2,preservesLargeTables:5,manual:true,notes:"Tavolo dehor separabile"},
  {id:"dehor-8",label:"8 dehor",area:"dehor",moduleIds:["dehor-8a","dehor-8b"],standardSeats:4,maxAdults:4,maxWithHighchairs:5,comfort:"normale",strategicCost:2,preservesLargeTables:5,manual:true,notes:"Tavolo dehor separabile"},
  {id:"dehor-9",label:"9 dehor",area:"dehor",moduleIds:["dehor-9"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:6,manual:true,notes:"Tavolo dehor singolo separabile"},
  {id:"dehor-10",label:"10 dehor",area:"dehor",moduleIds:["dehor-10"],standardSeats:2,maxAdults:2,maxWithHighchairs:3,comfort:"normale",strategicCost:1,preservesLargeTables:6,manual:true,notes:"Tavolo dehor singolo separabile"},

  {id:"dehor-1-6",label:"1+6 dehor",area:"dehor",moduleIds:["dehor-1","dehor-6a","dehor-6b"],standardSeats:6,maxAdults:6,maxWithHighchairs:7,comfort:"normale",strategicCost:3,preservesLargeTables:5,notes:"6 o 6+1 seggiolone"},
  {id:"dehor-2-5",label:"2+5 dehor",area:"dehor",moduleIds:["dehor-2","dehor-5a","dehor-5b"],standardSeats:6,maxAdults:6,maxWithHighchairs:7,comfort:"normale",strategicCost:3,preservesLargeTables:5,notes:"6 o 6+1 seggiolone"},
  {id:"dehor-3-4",label:"3+4 dehor",area:"dehor",moduleIds:["dehor-3","dehor-4a","dehor-4b"],standardSeats:6,maxAdults:6,maxWithHighchairs:7,comfort:"normale",strategicCost:3,preservesLargeTables:5,notes:"6 o 6+1 seggiolone"},
  {id:"dehor-8-9",label:"8+9 dehor",area:"dehor",moduleIds:["dehor-8a","dehor-8b","dehor-9"],standardSeats:6,maxAdults:6,maxWithHighchairs:7,comfort:"normale",strategicCost:3,preservesLargeTables:5,notes:"6 o 6+1 seggiolone"},
  {id:"dehor-10-7",label:"10+7 dehor",area:"dehor",moduleIds:["dehor-10","dehor-7a","dehor-7b"],standardSeats:6,maxAdults:6,maxWithHighchairs:7,comfort:"normale",strategicCost:3,preservesLargeTables:5,notes:"6 o 6+1 seggiolone"},

  {id:"dehor-2-5-extra",label:"2+5 dehor + extra",area:"dehor",moduleIds:["dehor-2","dehor-5a","dehor-5b","dehor-10"],standardSeats:8,maxAdults:8,maxWithHighchairs:8,comfort:"stretto",strategicCost:10,preservesLargeTables:1,requiresOpenAwning:true,takesExtraDehor2:true,manual:true,notes:"8 solo tende aperte"},
  {id:"dehor-3-4-extra",label:"3+4 dehor + extra",area:"dehor",moduleIds:["dehor-3","dehor-4a","dehor-4b","dehor-1"],standardSeats:8,maxAdults:8,maxWithHighchairs:8,comfort:"stretto",strategicCost:10,preservesLargeTables:1,requiresOpenAwning:true,takesExtraDehor2:true,manual:true,notes:"8 solo tende aperte"},
  {id:"dehor-8-9-extra",label:"8+9 dehor + extra",area:"dehor",moduleIds:["dehor-8a","dehor-8b","dehor-9","dehor-2"],standardSeats:8,maxAdults:8,maxWithHighchairs:8,comfort:"stretto",strategicCost:10,preservesLargeTables:1,requiresOpenAwning:true,takesExtraDehor2:true,manual:true,notes:"8 solo tende aperte"}
];

function Stat({icon:Icon,label,value}:{icon:React.ElementType;label:string;value:React.ReactNode}){return <Card className="rounded-2xl shadow-sm"><CardContent className="p-4 flex gap-3 items-center"><div className="p-2 rounded-xl bg-gray-100"><Icon className="w-5 h-5"/></div><div><div className="text-xs text-gray-500">{label}</div><div className="text-xl font-semibold">{value}</div></div></CardContent></Card>}

export default function DaDinoDashboard(){
const [selectedDate,setSelectedDate]=useState(todayISO());
const [settings,setSettings]=useState<Settings>({service:"cena",weather:"normale",risk:"medio",awning:"chiuse",resetMinutes:10,pinsaPct:60,kitchenPct:40,maxUsefulWait:15});
const [area,setArea]=useState<Area>("sala");
const [mapTurn,setMapTurn]=useState<MapTurn>("tutto");
const [search,setSearch]=useState("");
const [bookingMode,setBookingMode]=useState<BookingMode>("prenotazione");
const [manualOptionId,setManualOptionId]=useState<string>("automatico");
const [reservations,setReservations]=useState<Reservation[]>([]);
const [loadedFromCloud,setLoadedFromCloud]=useState(false);
const [customers,setCustomers]=useState<Customer[]>([]);
const [form,setForm]=useState<FormState>({name:"",phone:"",time:"21:00",adults:2,highchairs:0,category:"normale",areaPreference:"nessuna",consumption:"non_so",notes:""});

useEffect(() => {
  async function checkLogin() {
    const { supabase } = await import("@/lib/auth");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/login"; return; }
    if (session.user.email === "matteo@dadino.local") return;
    const role = await getCurrentUserRole();
    if (role !== "admin") window.location.href = "/servizio";
  }
  checkLogin();
}, []);

async function logout() {
  const { supabase } = await import("@/lib/auth");
  await supabase.auth.signOut();
  window.location.href = "/login";
}

useEffect(() => {
  async function loadCloudData() {
    const data = await loadReservations();
    setReservations(data);
    setLoadedFromCloud(true);
  }
  loadCloudData();
}, []);

const dayReservations=useMemo(()=>reservations.filter(r=>r.date===selectedDate),[reservations,selectedDate]);
const activeReservations=useMemo(()=>dayReservations.filter(r=>isActiveStatus(r.status)),[dayReservations]);
const enriched=useMemo(()=>dayReservations.map(r=>({...r,turn:getTurn(r.time,settings.service),estimatedEnd:fromMin(times(r,settings).end),resetEnd:fromMin(times(r,settings).resetEnd)})),[dayReservations,settings]);
function mapFilter(r:Reservation&{turn:string}){if(mapTurn==="primo")return r.turn==="primo turno";if(mapTurn==="secondo")return r.turn==="secondo turno";if(mapTurn==="fuori")return r.turn==="fuori turno";return true}
const occupiedModules=new globalThis.Map<string,any>();enriched.filter(r=>isActiveStatus(r.status)).filter(mapFilter).forEach(r=>r.moduleIds.forEach(m=>occupiedModules.set(m,r)));
function isAreaClosed(a:Area){return settings.weather==="pioggia"&&["esterno","marciapiede"].includes(a)}
function conflicts(option:TableOption,start:number,resetEnd:number){return activeReservations.filter(r=>{const rt=times(r,settings);return overlap(start,resetEnd,rt.start,rt.resetEnd)&&option.moduleIds.some(m=>r.moduleIds.includes(m))})}
function optionAvailable(option:TableOption,start:number,resetEnd:number){if(isAreaClosed(option.area))return false;if(option.requiresOpenAwning&&settings.awning!=="aperte")return false;return conflicts(option,start,resetEnd).length===0}
function earliestWait(option:TableOption,start:number,resetEnd:number){const c=conflicts(option,start,resetEnd);if(c.length===0)return 0;const latestReset=Math.max(...c.map(r=>times(r,settings).resetEnd));return Math.max(0,latestReset-start)}
function availabilityText(option:TableOption,start:number,resetEnd:number,wait:number){if(wait>0)return `Opzione con attesa: il cliente arriverebbe alle ${fromMin(start)}, tavolo pronto alle ${fromMin(start+wait)}. Attesa stimata ${wait} min.`;const related=activeReservations.filter(r=>option.moduleIds.some(m=>r.moduleIds.includes(m))).map(r=>({r,t:times(r,settings)})).sort((a,b)=>a.t.start-b.t.start);const prev=related.filter(x=>x.t.resetEnd<=start).pop();const next=related.find(x=>x.t.start>=resetEnd);return `${prev?`libero dalle ${fromMin(prev.t.resetEnd)}`:"libero da inizio servizio"}; ${next?`dabile fino alle ${fromMin(next.t.start)}`:"nessuna prenotazione dopo"}; ridabile dalle ${fromMin(resetEnd)}`}
function scoreOption(option:TableOption):ScoredOption|null{const base=times(form,settings);const adults=Number(form.adults||0);const highchairs=Number(form.highchairs||0);const total=adults+highchairs;const wait=optionAvailable(option,base.start,base.resetEnd)?0:earliestWait(option,base.start,base.resetEnd);if(isAreaClosed(option.area))return null;if(option.requiresOpenAwning&&settings.awning!=="aperte")return null;if(wait>settings.maxUsefulWait)return null;if(adults>option.maxAdults||total>option.maxWithHighchairs)return null;const effectiveStart=base.start+wait;const effectiveEnd=effectiveStart+base.dur;const effectiveReset=effectiveEnd+settings.resetMinutes;const warnings:string[]=[];const reasons:string[]=[];let score=100;
const empty=option.standardSeats-adults;if(empty===0){score+=45;reasons.push("riempie perfettamente i posti standard")}if(empty===1){score+=18;reasons.push("spreca solo 1 posto")}if(empty>1){score-=empty*32;warnings.push(`spreca ${empty} posti`)}if(adults>option.standardSeats){score-=18;warnings.push("richiede capotavola o soluzione stretta")}
score-=option.strategicCost*4;score+=option.preservesLargeTables*8;if(adults<=4&&option.strategicCost>=8){score-=55;warnings.push("rompe una possibile tavolata grande")};if(adults<=2&&option.standardSeats>2){score-=50;warnings.push("per 2 persone meglio preservare tavoli grandi")};if(adults>=8&&option.standardSeats>=8)reasons.push("adatta a tavolata grande");
if(wait>0){score-=wait*4;reasons.push(`permette di usare una soluzione migliore aspettando ${wait} min`);if(wait<=7)score+=25;if(wait>10)warnings.push("attesa da valutare con il cliente")}
if(form.areaPreference!=="nessuna"){if(form.areaPreference===option.area){score+=form.category==="normale"?5:35;reasons.push("rispetta la preferenza area")}else{warnings.push("preferenza area non rispettata per ottimizzare");if(form.category!=="normale")score-=40}}
if(settings.weather==="rischio"&&["dehor","esterno","marciapiede"].includes(option.area)){score-=settings.risk==="basso"?42:settings.risk==="medio"?20:6;warnings.push("penalizzata per rischio meteo")}
if(option.requiresOpenAwning){reasons.push("usa tende aperte");warnings.push("usa spazio extra dehor")};if(option.manual)warnings.push("conferma manuale consigliata");if(highchairs>0)warnings.push("verificare seggiolone");const tr=getTurn(form.time,settings.service);if(tr==="fuori turno"){score-=70;warnings.push("fuori turno: controllare passaggio")};if(settings.service==="cena"&&tr==="primo turno"&&effectiveReset>toMin("21:00")){score-=80;warnings.push("può comprimere il secondo turno")};if(tr==="secondo turno"){score+=18;reasons.push("secondo turno")}
const detailedReason=`${option.label}: ${reasons.length?reasons.join("; "):"soluzione disponibile"}. ${warnings.length?"Attenzioni: "+warnings.join("; "):"Nessuna criticità importante."} Score ${Math.round(score)}.`;
let passageMessage="";if(wait>0)passageMessage=`Conviene far aspettare solo se vuoi preservare altre combinazioni: attesa ${wait} min, tavolo pronto alle ${fromMin(effectiveStart)}.`;else if(settings.service==="cena"&&tr==="fuori turno")passageMessage=`Fuori turno: occupa fino alle ${fromMin(effectiveReset)}.`;else if(settings.service==="cena"&&tr==="primo turno"&&effectiveReset<=toMin("20:55"))passageMessage=`Passaggio buono: pronto alle ${fromMin(effectiveReset)} prima del secondo turno.`;else if(settings.service==="cena"&&tr==="primo turno")passageMessage=`Attenzione: pronto alle ${fromMin(effectiveReset)}, può stringere il secondo turno.`;
return{...option,score,warnings,reasons,detailedReason,turn:tr,estimatedEnd:fromMin(effectiveEnd),resetEnd:fromMin(effectiveReset),duration:base.dur,availabilityMessage:availabilityText(option,base.start,base.resetEnd,wait),passageMessage,waitMinutes:wait,suggestedStart:fromMin(effectiveStart),isWaitOption:wait>0}}
const suggestions=useMemo(()=>options.map(scoreOption).filter(Boolean).sort((a:any,b:any)=>b.score-a.score).slice(0,12) as ScoredOption[],[form,settings,activeReservations]);

function manualScoredOption(): ScoredOption | null {
  if (manualOptionId === "automatico") return null;
  const option = options.find((o) => o.id === manualOptionId);
  if (!option) return null;
  const base = times(form, settings);
  const tr = getTurn(form.time, settings.service);
  return {
    ...option,
    score: 0,
    warnings: ["assegnazione manuale scelta dall'admin"],
    reasons: ["tavolo scelto manualmente"],
    detailedReason: `${option.label}: assegnazione manuale. Controllare eventuali sovrapposizioni o cambi turno.`,
    turn: tr,
    estimatedEnd: fromMin(base.end),
    resetEnd: fromMin(base.resetEnd),
    duration: base.dur,
    availabilityMessage: "Assegnazione manuale: il sistema salva questo tavolo anche se non è tra i consigliati.",
    passageMessage: "",
    waitMinutes: 0,
    suggestedStart: form.time,
    isWaitOption: false,
  };
}

const capacityByArea={sala:27,saletta:18,dehor:settings.awning==="aperte"?34:30,marciapiede:settings.weather==="pioggia"?0:15,esterno:settings.weather==="pioggia"?0:36};const totalCapacity=capacityByArea.sala+capacityByArea.saletta+capacityByArea.dehor+capacityByArea.marciapiede+capacityByArea.esterno;const activeAdults=activeReservations.reduce((s,r)=>s+r.adults,0);const freeSeats=Math.max(totalCapacity-activeAdults,0);const firstTurn=enriched.filter(r=>r.turn==="primo turno"&&isActiveStatus(r.status));const secondTurn=enriched.filter(r=>r.turn==="secondo turno"&&isActiveStatus(r.status));const filteredReservations=enriched.filter(r=>{const q=search.trim().toLowerCase();return !q||r.name.toLowerCase().includes(q)||r.phone.toLowerCase().includes(q)||r.table.toLowerCase().includes(q)});
function saveCustomer(r:Reservation){if(!r.phone&&!r.name)return;setCustomers(prev=>{const existing=prev.find(c=>(r.phone&&c.phone===r.phone)||c.name.toLowerCase()===r.name.toLowerCase());if(existing)return prev.map(c=>c.id===existing.id?{...c,name:r.name||c.name,phone:r.phone||c.phone,category:r.category,notes:r.notes||c.notes,visits:c.visits+1,lastVisit:r.date}:c);return[{id:Date.now(),name:r.name,phone:r.phone,category:r.category,notes:r.notes,visits:1,lastVisit:r.date},...prev]})}
async function addReservation(option:ScoredOption=suggestions[0],mode:BookingMode=bookingMode){if(!option)return;const r:Reservation={id:Date.now(),date:selectedDate,name:form.name||"Senza nome",phone:form.phone,time:option.isWaitOption?option.suggestedStart:form.time,adults:Number(form.adults),highchairs:Number(form.highchairs),category:form.category,areaPreference:form.areaPreference,table:option.label,optionId:option.id,moduleIds:option.moduleIds,status:mode==="passaggio"?"seduto":"confermata",consumption:form.consumption,notes:form.notes,mode,suggestedWaitMinutes:option.waitMinutes};const updated=[r,...reservations];setReservations(updated);await saveReservations(updated);saveCustomer(r);setForm({name:"",phone:"",time:"21:00",adults:2,highchairs:0,category:"normale",areaPreference:"nessuna",consumption:"non_so",notes:""});setManualOptionId("automatico")}
async function updateStatus(id:number,status:Status){const updated=reservations.map(r=>r.id===id?{...r,status,seatedAt:status==="seduto"&&!r.seatedAt?Date.now():r.seatedAt}:r);setReservations(updated);await saveReservations(updated)}
async function removeReservation(id:number){const updated=reservations.filter(r=>r.id!==id);setReservations(updated);await saveReservations(updated)}

return <div className="min-h-screen p-3 md:p-5 bg-gray-50"><div className="max-w-7xl mx-auto space-y-4"><div className="flex justify-between gap-3 flex-col md:flex-row"><div><h1 className="text-2xl md:text-3xl font-bold">Da Dino · Gestione tavoli</h1><p className="text-gray-600 text-sm">Prenotazioni, passaggi, turni e assegnazione automatica.</p></div><div className="flex gap-2 flex-wrap"><Button variant={bookingMode==="prenotazione"?"default":"outline"} onClick={()=>setBookingMode("prenotazione")}>Prenotazione</Button><Button variant={bookingMode==="passaggio"?"default":"outline"} onClick={()=>setBookingMode("passaggio")}><Zap className="w-4 h-4 mr-2"/>Passaggio</Button><Button variant="outline" onClick={()=>window.location.href="/servizio"}>Modalità servizio</Button><Button variant="outline" onClick={logout}><LogOut className="w-4 h-4 mr-2"/>Esci</Button></div></div><div className="grid grid-cols-2 md:grid-cols-5 gap-3"><Stat icon={Users} label="Posti liberi stimati" value={freeSeats}/><Stat icon={Clock3} label="1° / 2° turno" value={`${firstTurn.reduce((a,r)=>a+r.adults,0)} / ${secondTurn.reduce((a,r)=>a+r.adults,0)}`}/><Stat icon={MapPinned} label="Capienza max" value={totalCapacity}/><Stat icon={CloudRain} label="Meteo" value={settings.weather}/><Stat icon={BarChart3} label="Clienti salvati" value={customers.length}/></div><Card className="rounded-2xl"><CardContent className="p-3 grid grid-cols-2 md:grid-cols-8 gap-2"><label className="text-xs text-gray-500">Data<input className="border rounded-xl p-2 w-full text-sm" type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></label><label className="text-xs text-gray-500">Servizio<select className="border rounded-xl p-2 w-full text-sm" value={settings.service} onChange={e=>setSettings({...settings,service:e.target.value as Service})}><option value="pranzo">Pranzo</option><option value="cena">Cena</option></select></label><label className="text-xs text-gray-500">Meteo<select className="border rounded-xl p-2 w-full text-sm" value={settings.weather} onChange={e=>setSettings({...settings,weather:e.target.value as Weather,awning:e.target.value==="pioggia"?"chiuse":settings.awning})}><option value="normale">Normale</option><option value="rischio">Rischio</option><option value="pioggia">Pioggia</option></select></label><label className="text-xs text-gray-500">Rischio<select className="border rounded-xl p-2 w-full text-sm" value={settings.risk} onChange={e=>setSettings({...settings,risk:e.target.value as Risk})}><option value="basso">Basso</option><option value="medio">Medio</option><option value="alto">Alto</option></select></label><label className="text-xs text-gray-500">Tende<select className="border rounded-xl p-2 w-full text-sm" value={settings.awning} disabled={settings.weather==="pioggia"} onChange={e=>setSettings({...settings,awning:e.target.value as Awning})}><option value="chiuse">Chiuse</option><option value="aperte">Aperte</option></select></label><label className="text-xs text-gray-500">Reset<select className="border rounded-xl p-2 w-full text-sm" value={settings.resetMinutes} onChange={e=>setSettings({...settings,resetMinutes:Number(e.target.value)})}><option value={10}>10 min</option><option value={7}>7 min</option></select></label><label className="text-xs text-gray-500">Pinsa %<input className="border rounded-xl p-2 w-full text-sm" type="number" value={settings.pinsaPct} onChange={e=>{const p=Number(e.target.value);setSettings({...settings,pinsaPct:p,kitchenPct:100-p})}}/></label><label className="text-xs text-gray-500">Attesa max<input className="border rounded-xl p-2 w-full text-sm" type="number" value={settings.maxUsefulWait} onChange={e=>setSettings({...settings,maxUsefulWait:Number(e.target.value)})}/></label></CardContent></Card>{settings.weather==="pioggia"&&<div className="bg-white border rounded-2xl p-3 flex gap-3 text-sm"><AlertTriangle/>Pioggia: esterno e marciapiede esclusi.</div>}<div className="grid xl:grid-cols-[330px_1fr_450px] gap-4"><Card className="rounded-2xl"><CardContent className="p-4 space-y-3"><h2 className="text-lg font-bold">{bookingMode==="passaggio"?"Inserisci passaggio":"Inserisci prenotazione"}</h2><input className="w-full border rounded-xl p-3" placeholder="Nome" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input className="w-full border rounded-xl p-3" placeholder="Telefono" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><div className="grid grid-cols-2 gap-2"><label className="text-sm text-gray-500">Orario<input className="border rounded-xl p-3 w-full" type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></label><label className="text-sm text-gray-500">Adulti<input className="border rounded-xl p-3 w-full" type="number" min="1" value={form.adults} onChange={e=>setForm({...form,adults:Number(e.target.value)})}/></label></div><label className="text-sm text-gray-500">Seggioloni<input className="border rounded-xl p-3 w-full" type="number" min="0" value={form.highchairs} onChange={e=>setForm({...form,highchairs:Number(e.target.value)})}/></label><div className="grid grid-cols-2 gap-2"><select className="border rounded-xl p-3" value={form.category} onChange={e=>setForm({...form,category:e.target.value as Category})}><option value="normale">Normale</option><option value="affezionato">Affezionato</option><option value="molto_importante">VIP</option></select><select className="border rounded-xl p-3" value={form.areaPreference} onChange={e=>setForm({...form,areaPreference:e.target.value as any})}><option value="nessuna">Nessuna area</option>{AREAS.map(a=><option key={a} value={a}>{a}</option>)}</select></div><select className="border rounded-xl p-3 w-full" value={form.consumption} onChange={e=>setForm({...form,consumption:e.target.value as Consumption})}><option value="non_so">Consumo non so</option><option value="pinsa">Pinsa</option><option value="cucina">Cucina</option><option value="misto">Misto</option></select><label className="text-sm text-gray-500">Tavolo manuale<select className="border rounded-xl p-3 w-full mt-1" value={manualOptionId} onChange={e=>setManualOptionId(e.target.value)}><option value="automatico">Automatico consigliato</option>{AREAS.map(a=><optgroup key={a} label={a}>{options.filter(o=>o.area===a).map(o=><option key={o.id} value={o.id}>{o.label} · {o.standardSeats}/{o.maxAdults} posti</option>)}</optgroup>)}</select></label><textarea className="border rounded-xl p-3 w-full" placeholder="Note" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><Button className="w-full rounded-2xl" disabled={manualOptionId==="automatico"&&!suggestions[0]} onClick={()=>{const manual=manualScoredOption();addReservation(manual || suggestions[0])}}><CheckCircle2 className="w-4 h-4 mr-2"/>{manualOptionId==="automatico"?"Conferma suggerito":"Conferma tavolo manuale"}</Button></CardContent></Card><Card className="rounded-2xl"><CardContent className="p-4"><div className="flex justify-between gap-3 mb-3 flex-col md:flex-row"><div><h2 className="text-lg font-bold">Moduli tavoli</h2><p className="text-sm text-gray-500">{area} · {mapTurn}</p></div><div className="flex gap-1 flex-wrap">{AREAS.map(a=><Button key={a} size="sm" variant={area===a?"default":"outline"} onClick={()=>setArea(a)}>{a}</Button>)}</div></div><div className="flex gap-1 mb-3 flex-wrap"><Button size="sm" variant={mapTurn==="tutto"?"default":"outline"} onClick={()=>setMapTurn("tutto")}>Tutto</Button><Button size="sm" variant={mapTurn==="primo"?"default":"outline"} onClick={()=>setMapTurn("primo")}>1°</Button><Button size="sm" variant={mapTurn==="secondo"?"default":"outline"} onClick={()=>setMapTurn("secondo")}>2°</Button><Button size="sm" variant={mapTurn==="fuori"?"default":"outline"} onClick={()=>setMapTurn("fuori")}>Fuori</Button></div><div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">{modules.filter(m=>m.area===area).map(m=>{const occ=occupiedModules.get(m.id);const closed=isAreaClosed(m.area);const cls=closed?"bg-gray-200 text-gray-500 border-gray-300":occ?"bg-red-100 border-red-300 text-red-950":"bg-green-100 border-green-300 text-green-950";return <div key={m.id} className={`border rounded-2xl p-3 min-h-[90px] ${cls}`}><div className="flex justify-between"><b>{m.label}</b><span className="text-xs">{m.size}</span></div><div className="text-xs mt-2 opacity-80">{closed?"Non utilizzabile":occ?`${occ.name} · ${occ.time} · ${occ.resetEnd}`:`${m.seats} posti · libero`}</div></div>})}</div></CardContent></Card><Card className="rounded-2xl"><CardContent className="p-4 space-y-3"><h2 className="text-lg font-bold flex gap-2"><Search/>Soluzioni</h2>{suggestions.length===0&&<div className="text-sm text-gray-500">Nessuna soluzione disponibile.</div>}{suggestions.map((s,i)=><div className={`border rounded-2xl p-3 bg-white ${s.isWaitOption?"border-blue-300":""}`} key={s.id+s.waitMinutes}><div className="flex justify-between gap-2"><div><b>{i===0?"Consigliato · ":""}{s.label}</b><div className="text-xs text-gray-500">{s.area} · {s.standardSeats}/{s.maxAdults} · score {Math.round(s.score)}</div><div className="text-xs text-gray-500">{s.turn} · inizio {s.suggestedStart} · fine {s.estimatedEnd} · pronto {s.resetEnd}</div></div><Button size="sm" variant="outline" onClick={()=>addReservation(s)}>Scegli</Button></div><p className="text-xs mt-2 font-medium">{s.detailedReason}</p><p className="text-xs mt-1 text-blue-700">{s.availabilityMessage}</p>{s.passageMessage&&<p className="text-xs mt-1 text-blue-700">{s.passageMessage}</p>}</div>)}</CardContent></Card></div><div className="grid lg:grid-cols-2 gap-4"><ReservationList title="Primo turno" data={firstTurn} updateStatus={updateStatus} removeReservation={removeReservation}/><ReservationList title="Secondo turno" data={secondTurn} updateStatus={updateStatus} removeReservation={removeReservation}/></div><Card className="rounded-2xl"><CardContent className="p-4"><div className="flex flex-col md:flex-row justify-between gap-3 mb-3"><h2 className="text-lg font-bold">Tutte le prenotazioni</h2><input className="border rounded-xl p-2" placeholder="Cerca" value={search} onChange={e=>setSearch(e.target.value)}/></div><ReservationTable data={filteredReservations} updateStatus={updateStatus} removeReservation={removeReservation}/></CardContent></Card></div></div>}

function ReservationList({title,data,updateStatus,removeReservation}:{title:string;data:any[];updateStatus:(id:number,status:Status)=>void;removeReservation:(id:number)=>void}){return <Card className="rounded-2xl"><CardContent className="p-4"><h2 className="text-lg font-bold flex gap-2 mb-3"><Utensils/>{title}</h2><ReservationTable data={data} updateStatus={updateStatus} removeReservation={removeReservation}/></CardContent></Card>}
function ReservationTable({data,updateStatus,removeReservation}:{data:any[];updateStatus:(id:number,status:Status)=>void;removeReservation:(id:number)=>void}){return <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{data.length===0&&<tr><td className="py-3 text-gray-500">Nessuna prenotazione</td></tr>}{data.map(r=><tr key={r.id} className="border-b align-top"><td className="py-2 font-medium">{r.time}</td><td>{r.name}<div className="text-xs text-gray-500">{r.phone}</div></td><td>{r.adults}{r.highchairs?` + ${r.highchairs} seg.`:""}</td><td>{r.table}<div className="text-xs text-gray-500">{r.estimatedEnd}/{r.resetEnd}</div>{r.suggestedWaitMinutes? <div className="text-xs text-blue-700">attesa {r.suggestedWaitMinutes} min</div>:null}</td><td><span className={`text-xs px-2 py-1 rounded-full ${statusClass(r.status)}`}>{r.status}</span></td><td className="space-x-1 whitespace-nowrap"><Button size="sm" variant="outline" onClick={()=>updateStatus(r.id,"arrivato")}>Arrivato</Button><Button size="sm" variant="outline" onClick={()=>updateStatus(r.id,"seduto")}>Seduto</Button><Button size="sm" variant="outline" onClick={()=>updateStatus(r.id,"pagato")}>Pagato</Button><Button size="sm" variant="outline" onClick={()=>updateStatus(r.id,"liberato")}>Liberato</Button><Button size="sm" variant="outline" onClick={()=>updateStatus(r.id,"no_show")}>No-show</Button><Button size="sm" variant="outline" onClick={()=>removeReservation(r.id)}><Trash2 className="w-4 h-4"/></Button></td></tr>)}</tbody></table></div>}
