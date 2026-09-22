import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DesignIR } from '../types/ir';
import { generate } from '../index';

const dir = dirname(fileURLToPath(import.meta.url));
const sample = process.argv[2] ?? 'admin';
const stackArg = process.argv[3] === 'tailwind' ? 'tailwind' : 'antd';
const fixtures: Record<string, { path: string; viewName: string }> = {
  'set-price': {
    path: '../fixtures/set-price-33546-579500.json',
    viewName: 'SetPriceView',
  },
  table: {
    path: '../fixtures/pricing-by-location-table.json',
    viewName: 'PricingByLocationView',
  },
  campaign: {
    path: '../fixtures/campaign-left.json',
    viewName: 'LeftView',
  },
  admin: {
    path: '../fixtures/connexup-admin-3747-10096.json',
    viewName: 'AdminPortalPageView',
  },
};
const selected = fixtures[sample] ?? fixtures.admin!;
const fixturePath = join(dir, selected.path);
const ir = JSON.parse(readFileSync(fixturePath, 'utf-8')) as DesignIR;

const react = generate(ir, {
  stack: stackArg,
  format: 'react',
  viewName: selected.viewName,
});
const html = generate(ir, { stack: stackArg, format: 'html' });

console.log(`=== React (${stackArg}) ===\n`);
console.log(react.code);
console.log('\n=== HTML preview ===\n');
console.log(html.code.slice(0, 500), '...\n');
