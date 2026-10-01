import { describe, it, expect } from 'vitest';
import { portableBoard, validatePortableBoard, applyPortableBoard } from './boardContract';
const privateWorkspace={tabs:{pacing:{controls:{monthlyTarget:'100000'},blocks:{'s-pace':{width:'half',scope:{countries:['private client'],dateStart:'2024-01-01'}}},charts:[{id:'user-id',name:'Private campaign',metric:'cost',dim:'country',type:'bar'},{id:'formula',metric:'user-formula',dim:'country'}],order:['user-id','s-pace']}},legacy:{raw:[{cost:999}],customMetrics:{secret:'formula'}}};
describe('portable board privacy boundary',()=>{
  it('retains layout and standard chart definitions but drops user data and formulas',()=>{
    const board=portableBoard(privateWorkspace,'Weekly');
    expect(board.tabs.pacing.blocks['s-pace']).toMatchObject({width:'half'});
    expect(board.tabs.pacing.charts).toHaveLength(1);
    expect(board.tabs.pacing.order).toEqual(['custom-0','s-pace']);
    expect(JSON.stringify(board)).not.toMatch(/private|Private|2024|100000|999|secret|user-id|formula/);
    expect(validatePortableBoard(board)).toEqual(board);
    expect(applyPortableBoard({boards:[{name:'keep'}]},board).boards).toEqual([{name:'keep'}]);
  });
  it('rejects fields that could bypass the browser projection',()=>{
    const board=portableBoard(privateWorkspace,'Weekly');
    for(const payload of [{...board,raw:[]},{...board,tabs:{...board.tabs,pacing:{...board.tabs.pacing,scope:{countries:['Secret']}}}},{...board,tabs:{unknown:{}}},{...board,version:2}])expect(()=>validatePortableBoard(payload)).toThrow('INVALID_BOARD');
  });
  it('restores shared scope, never the sender’s data-specific filters',()=>{
    const restored=applyPortableBoard(privateWorkspace,portableBoard(privateWorkspace,'Weekly'));
    expect(restored.tabs.pacing.blocks['s-pace'].scope).toBeUndefined();
    expect(restored.tabs.pacing.charts[0].metric).toBe('cost');
  });
});
