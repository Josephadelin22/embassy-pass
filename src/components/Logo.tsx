import logo from "@/assets/inov-logo.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img src={logo} alt="INOV E-TECH .L Ltd" className="h-10 w-10 object-contain" />
      {showText && (
        <div className="leading-tight">
          <div className="font-display font-bold text-base tracking-tight">INOV E-TECH .L Ltd</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            IN-ACCESS
          </div>
        </div>
      )}
    </div>
  );
}
