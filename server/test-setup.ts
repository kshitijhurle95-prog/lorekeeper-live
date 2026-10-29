import path from 'node:path';

process.env.DB_FILE = path.resolve('data', `vitest-${process.pid}.sqlite`);
