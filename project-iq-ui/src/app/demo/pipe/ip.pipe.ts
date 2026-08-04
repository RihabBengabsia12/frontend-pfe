import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'localIp' })
export class LocalIpPipe implements PipeTransform {
  transform(ip: string): string {
    if (!ip) return '—';
    if (ip === '0:0:0:0:0:0:0:1' || ip === '::1') return 'localhost';
    if (ip.startsWith('127.')) return '127.0.0.1';
    if (ip === '0.0.0.0') return 'Serveur Local';
    return ip;
  }
}
