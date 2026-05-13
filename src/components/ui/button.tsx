import * as React from "react";
type Props=React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'default'|'outline', size?:'sm'|'default'};
export function Button({className='',variant='default',size='default',...props}:Props){const base='inline-flex items-center justify-center font-medium disabled:opacity-50 disabled:pointer-events-none transition'; const v=variant==='outline'?'border bg-white hover:bg-gray-50':'bg-gray-900 text-white hover:bg-gray-800'; const s=size==='sm'?'h-8 px-3 text-sm':'h-10 px-4'; return <button className={`${base} ${v} ${s} ${className}`} {...props}/>}
