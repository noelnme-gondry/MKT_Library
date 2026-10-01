import {test,expect} from '@playwright/test';
import {FOLLOWUP_TOOL_SPECS} from '../src/lib/recipe/followupSpecs';
if (process.env.FOLLOWUP_VIEWPORT) test.use({viewport:{width:Number(process.env.FOLLOWUP_VIEWPORT),height:1000}});
import {ROUTES} from '../src/lib/routeMap';
for(const locale of ['ko','en']) for(const id of Object.keys(FOLLOWUP_TOOL_SPECS)) {
  test(`follow-up ${id} scope and surfaces (${locale})`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.emulateMedia({colorScheme:locale==='ko'?'light':'dark'});
    await page.goto(`${locale==='en'?'/en':''}${ROUTES.find(r=>r.id===id).slug}?example=1`);
    const root=page.locator('.tool-autonomy');await expect(root).toBeVisible();
    await expect(root.locator('.tool-recipe-controls')).toBeVisible({timeout:45000});
    await expect(page.locator('.tool-next-step-panel')).toBeVisible();
    // Deferred analysis and Chart.js resize can finish after the static footer mounts.
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    const command=root.getByRole('combobox',{name:locale==='en'?'Analysis and view settings':'분석·보기 설정'});
    await command.fill(locale==='en'?'PNG with title only':'PNG에 제목만 넣기');
    await expect(root.getByRole('option').first()).toBeVisible();await command.press('Enter');
    await expect(root.locator('.recipe-command__chip')).toContainText(locale==='en'?'PNG with title only':'PNG에 제목만 넣기');
    const surfaces=root.locator('.block:visible');
    if(locale==='ko')for(let i=0;i<await surfaces.count();i++) {
      if(!(await surfaces.nth(i).getAttribute('class')).includes('mmm-stage-nav'))expect(await surfaces.nth(i).evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(255, 255, 255)');
    }
    expect(errors).toEqual([]);
  });
}
