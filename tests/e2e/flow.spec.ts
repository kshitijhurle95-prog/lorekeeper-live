import { test, expect } from '@playwright/test';
test('demo nomination to persistent memory and live overlay',async({page})=>{
 await page.goto('/');
 await page.screenshot({path:'test-results/overview-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Settings'}).click();
 await page.getByRole('button',{name:'Enter local demo mode'}).click();
 await expect(page.getByText('Local demo session',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Live Lore'}).click();
 await page.getByLabel('Chat message').fill('!nominate We found a secret dragon in the moonlit garden');
 await page.getByRole('button',{name:'Send demo message'}).click();
 await expect(page.getByText('We found a secret dragon in the moonlit garden')).toBeVisible();
 await page.getByRole('button',{name:'Start vote'}).click();
 const nominationId=(await page.locator('.nomination-id').first().textContent())?.replace('#','').trim();
 await page.getByLabel('Chat message').fill(`!vote ${nominationId}`);
 await page.getByRole('button',{name:'Send demo message'}).click();
 await expect(page.getByText('1',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Send demo message'}).click();
 await expect(page.getByText('already voted')).toBeVisible();
 await page.getByRole('button',{name:'Close voting'}).click();
 await page.getByRole('button',{name:'Approve memory'}).click();
 await page.getByRole('button',{name:'Memory Archive'}).click();
 await expect(page.locator('.archive-memory .memory-copy b').filter({hasText:'We found a secret dragon in the moonlit garden'})).toBeVisible();
 const memoryRow=page.locator('.archive-memory').first();await memoryRow.getByRole('button',{name:'Edit details'}).click();await memoryRow.getByLabel('Summary').fill('The community uncovered a secret dragon in the moonlit garden.');await page.getByRole('button',{name:'Save changes'}).click();await expect(memoryRow.getByText('The community uncovered a secret dragon in the moonlit garden.')).toBeVisible();
 await page.getByRole('button',{name:'Stream Overlay'}).click();
 const link=page.getByRole('link',{name:'Open overlay route'});const url=await link.getAttribute('href');expect(url).toContain('/overlay/');
 const overlay=await page.context().newPage();await overlay.goto(new URL(url!,page.url()).toString());
 await expect(overlay.locator('.overlay-title')).toHaveText('We found a secret dragon in the moonlit garden');
 await page.reload();await page.getByRole('button',{name:'Memory Archive'}).click();
 await expect(page.locator('.archive-memory .memory-copy b').filter({hasText:'We found a secret dragon in the moonlit garden'})).toBeVisible();
});

test('mobile navigation fits the viewport and keyboard actions remain available',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('/');
 await page.screenshot({path:'test-results/overview-mobile.png',fullPage:true});
 const widths=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));expect(widths.scroll).toBeLessThanOrEqual(widths.client);
 await page.getByRole('button',{name:'Open navigation'}).click();await expect(page.getByRole('button',{name:'Memory Archive'})).toBeVisible();
 await page.getByRole('button',{name:'Memory Archive'}).click();await expect(page.getByText('Your archive is quiet for now')).toBeVisible();await page.close();
});

test('mutating demo API rejects requests without CSRF and without demo session',async({page})=>{
 await page.goto('/');const bootstrap=await page.evaluate(async()=>fetch('/api/bootstrap').then(r=>r.json()));
 const noCsrf=await page.evaluate(async()=>fetch('/api/demo/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status));expect(noCsrf).toBe(403);
 const noDemo=await page.evaluate(async(csrf)=>fetch('/api/demo/message',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({username:'viewer',text:'!nominate A sufficiently long moment'})}).then(r=>r.status),bootstrap.csrf);expect(noDemo).toBe(403);
});
