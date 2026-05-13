import * as React from "react";
export function Card({className='',...props}:React.HTMLAttributes<HTMLDivElement>){return <div className={`bg-white border ${className}`} {...props}/>}
export function CardContent({className='',...props}:React.HTMLAttributes<HTMLDivElement>){return <div className={className} {...props}/>}
