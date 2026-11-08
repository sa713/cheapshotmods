import { requireThat } from '@chm/rules';

// One application process. Bounded map, one minute windows. The global cap
// also bounds anonymous sessions even when clients change IP/cookies.
export class LoginLimiter {
  private window = -1;
  private total = 0;
  private clients = new Map<string, number>();
  check(ip: string, now = Date.now()) {
    const window=Math.floor(now/60000);
    if (window!==this.window) { this.window=window; this.total=0; this.clients.clear(); }
    const n=this.clients.get(ip)??0;
    requireThat(n<20 && this.total<100,'LOGIN_RATE_LIMIT',429);
    this.clients.set(ip,n+1); this.total++;
  }
}
