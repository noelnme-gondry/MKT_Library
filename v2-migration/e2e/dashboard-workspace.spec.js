import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const paid = () => ({ plan:'paid', account:true, payment:true, expiresAt:Date.now()+86400000, offlineUntil:Date.now()+3600000 });
for (const locale of ['ko','en']) {
  test(`all dashboard tabs retain analysis surfaces and free controls (${locale})`, async ({page}) => {
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>localStorage.setItem('mkt-library-source-survey-answered','1'));
    await page.emulateMedia({colorScheme:'light'});
    await page.goto(`${locale==='en'?'/en':''}/dashboard?example=1`);
    await expect(page.locator('#s-kpi')).toBeVisible();
    const tabs=await page.locator('[id^="dashboard-tab-"]').evaluateAll(nodes=>nodes.map(node=>node.id));
    expect(tabs).toHaveLength(9);
    for (const id of tabs) {
      await page.locator(`#${id}`).click();
      await expect(page.locator('.dashboard-block-grid')).toBeVisible();
      const surfaces=page.locator('.dashboard-layout-block > .block');
      for(let i=0;i<await surfaces.count();i++) {
        if(await surfaces.nth(i).isVisible()) expect(await surfaces.nth(i).evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    }
    await page.getByRole('button',{name:locale==='en'?'Edit dashboard · Pro':'대시보드 편집 · Pro',exact:true}).click();
    await expect(page.locator('.dashboard-editor')).toHaveCount(0);
    await expect(page.locator('.dashboard-workspace-notice')).toContainText('Pro');
    expect(errors).toEqual([]);
  });
  test(`Pro scope, native analysis, cancel, saved boards and expiry (${locale})`,async({page})=>{
    const en=locale==='en',t=(ko,eng)=>en?eng:ko;
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let entitlement=paid();
    await page.route('**/api/account/session',route=>route.fulfill({json:{enabled:true,account:{id:'workspace-test',email:'workspace@example.com'},entitlement}}));
    await page.route('**/api/payments/access',route=>route.fulfill({json:{entitlement}}));
    await page.route('**/api/account/recipes',route=>route.fulfill({json:{recipes:[],canApply:true}}));
    await page.addInitScript(()=>localStorage.setItem('mkt-library-source-survey-answered','1'));
    await page.goto(`${en?'/en':''}/dashboard?example=1`);
    await expect(page.locator('#s-kpi')).toBeVisible();
    await page.locator('#dashboard-tab-pacing').click();
    const initial=await page.locator('#s-pace .ab-stat-value').first().textContent();
    await page.getByRole('button',{name:t('대시보드 편집 · Pro','Edit dashboard · Pro'),exact:true}).click();
    const editor=page.locator('.dashboard-editor');
    await expect(editor).toBeVisible();
    await editor.getByLabel(t('편집할 구역','Selected block')).selectOption('s-pace');
    await editor.getByRole('button',{name:t('데이터','Data'),exact:true}).click();
    await editor.getByLabel('KR',{exact:true}).check();
    await expect(page.locator('#s-pace .ab-stat-value').first()).not.toHaveText(initial);
    await expect(page.locator('#pacing-chart')).toHaveCount(1);
    await editor.getByRole('button',{name:t('차트 추가','Add chart'),exact:true}).click();
    await editor.getByLabel(t('차트 제목','Chart title')).fill('KR spend');
    await editor.getByLabel(t('국가','Country')).count(); // fieldset/legend exists independently of common filters.
    await editor.getByLabel('KR',{exact:true}).check();
    await editor.getByRole('button',{name:t('모양','Appearance'),exact:true}).click();
    await editor.getByLabel(t('차트 종류','Chart type')).selectOption('scorecard');
    const value=await page.locator('.dashboard-custom-block .custom-scorecard strong').textContent();
    expect(value).not.toBe('—');
    await editor.getByRole('button',{name:t('배치','Layout'),exact:true}).click();
    await editor.getByLabel(t('구역 폭','Block width')).selectOption('half');
    await editor.getByRole('button',{name:t('복제','Duplicate'),exact:true}).click();
    await editor.getByRole('button',{name:t('데이터','Data'),exact:true}).click();
    await editor.getByLabel(t('차트 제목','Chart title')).fill('US spend');
    await editor.getByLabel('KR',{exact:true}).uncheck();
    await editor.getByLabel('US',{exact:true}).check();
    await expect(page.locator('.dashboard-custom-block .custom-scorecard strong').last()).not.toHaveText(value);
    await editor.getByRole('combobox',{name:t('분석 기간','Analysis dates'),exact:true}).selectOption('custom');
    await editor.getByLabel(t('분석 시작일','Analysis start')).fill('2024-03-01');
    await editor.getByLabel(t('분석 종료일','Analysis end')).fill('2024-03-07');
    await editor.getByLabel(t('비교 기간 지정','Use comparison dates')).check();
    await editor.getByLabel(t('비교 시작일','Comparison start')).fill('2024-02-01');
    await editor.getByLabel(t('비교 종료일','Comparison end')).fill('2024-02-07');
    await expect(page.locator('.dashboard-custom-block').last()).toContainText(t('비교 기간','Comparison period'));
    await page.getByRole('button',{name: `US spend: ${t('위로','move up')}`,exact:true}).click();
    await expect(page.locator('.dashboard-custom-block h2').first()).toHaveText('US spend');
    await editor.getByLabel(t('보드 이름','Board name')).fill('Weekly check');
    await editor.getByRole('button',{name:t('현재 구성을 보드로 보관','Keep current layout as a board')}).click();
    const axe=await new AxeBuilder({page}).include('.dashboard-editor').withTags(['wcag2a','wcag2aa']).analyze();
    expect(axe.violations).toEqual([]);
    await page.getByRole('button',{name:t('편집 저장','Save edits'),exact:true}).click();
    await expect(editor).toHaveCount(0);
    await page.getByRole('button',{name:t('대시보드 편집 · Pro','Edit dashboard · Pro'),exact:true}).click();
    await editor.getByRole('button',{name:t('현재 탭 기본 배치 복원','Reset this tab')}).click();
    await expect(page.locator('.dashboard-custom-block')).toHaveCount(0);
    await page.getByRole('button',{name:t('취소','Cancel'),exact:true}).click();
    await expect(page.locator('.dashboard-custom-block')).toHaveCount(2);
    // A hidden native plot must regain a live canvas when restored, not just its DOM.
    await page.getByRole('button',{name:t('대시보드 편집 · Pro','Edit dashboard · Pro'),exact:true}).click();
    await editor.getByLabel(t('편집할 구역','Selected block')).selectOption('s-pace');
    await editor.getByRole('button',{name:t('배치','Layout'),exact:true}).click();
    await editor.getByRole('button',{name:t('구역 숨기기','Hide block'),exact:true}).click();
    await page.getByRole('button',{name:t('편집 저장','Save edits'),exact:true}).click();
    await expect(page.locator('#pacing-chart')).toHaveCount(0);
    await page.getByRole('button',{name:t('대시보드 편집 · Pro','Edit dashboard · Pro'),exact:true}).click();
    await editor.getByLabel(t('편집할 구역','Selected block')).selectOption('s-pace');
    await editor.getByRole('button',{name:t('구역 다시 표시','Show block'),exact:true}).click();
    await expect.poll(()=>page.locator('#pacing-chart').evaluate(canvas=>{
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let painted=0;for(let i=3;i<pixels.length;i+=4) if(pixels[i]) painted++;
      return painted;
    })).toBeGreaterThan(100);
    await page.locator('#s-pace').getByRole('radio',{name:t('설치','Installs'),exact:true}).click();
    await page.getByRole('button',{name:t('편집 저장','Save edits'),exact:true}).click();
    await page.getByRole('button',{name:t('대시보드 편집 · Pro','Edit dashboard · Pro'),exact:true}).click();
    await page.locator('#s-pace').getByRole('radio',{name:t('비용','Cost'),exact:true}).click();
    await page.getByRole('button',{name:t('취소','Cancel'),exact:true}).click();
    await expect(page.locator('#s-pace').getByRole('radio',{name:t('설치','Installs'),exact:true})).toHaveAttribute('aria-checked','true');
    await page.reload(); await page.goto(`${en?'/en':''}/dashboard?example=1`); await page.locator('#dashboard-tab-pacing').click();
    await expect(page.locator('.dashboard-custom-block')).toHaveCount(2);
    await expect(page.locator('#s-pace').getByRole('radio',{name:t('설치','Installs'),exact:true})).toHaveAttribute('aria-checked','true');
    entitlement=null;
    await page.reload();await page.goto(`${en?'/en':''}/dashboard?example=1`);await page.locator('#dashboard-tab-pacing').click();
    await expect(page.locator('.dashboard-custom-block')).toHaveCount(2);
    await page.getByRole('button',{name:t('대시보드 편집 · Pro','Edit dashboard · Pro'),exact:true}).click();
    await expect(editor).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}
