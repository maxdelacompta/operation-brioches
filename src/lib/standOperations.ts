export type Operation = {id:string;at:string;kind:'brioche'|'don';qty:number;amount:number;method?:string}
export const operationsKey=(id:string)=>`ob-stand-operations-v1-${id}`
export function readOperations(id:string):Operation[]{try {const d:unknown=JSON.parse(localStorage.getItem(operationsKey(id))||'[]');return Array.isArray(d)?d.filter((o):o is Operation=>Boolean(o&&typeof o==='object'&&'kind'in o&&'id'in o)):[]}catch{return []}}
