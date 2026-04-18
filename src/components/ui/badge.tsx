
import * as React from "react"
import { cn } from "@/lib/utils"

function Badge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-slate-900 text-slate-50 shadow hover:bg-slate-900/80", className)} {...props} />
  )
}
export { Badge }
