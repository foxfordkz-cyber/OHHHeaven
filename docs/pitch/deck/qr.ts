import { qrSvg } from '../../../server/src/qr';
process.stdout.write(qrSvg(process.argv[2], 8));
