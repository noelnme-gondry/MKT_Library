import {describe,it,expect} from 'vitest';
import {selectOrganicForecastResolution} from './forecastOrganicResolution';
const model = errors => ({run:{},panel:{},selection:{horizon:2,nested:{
  developmentFolds:errors.map((error,i)=>({offset:(i+1)*2,actual:[100,100],predicted:[100+error,100+error]})),
  latest:{actual:[100,100],predicted:[1,1]},
}}});
describe('Organic forecast input resolution',()=>{
  it('selects distinct channel responses on common older folds and ignores the sealed outcome',()=>{
    const aggregate=model([10,12,8]),detailed=model([4,6,5]);
    const result=selectOrganicForecastResolution(aggregate,detailed);
    expect(result).toMatchObject({resolution:'channel',comparable:true,folds:3,aggregateWmape:10,detailedWmape:5,latestUsedForSelection:false});
    aggregate.selection.nested.latest={actual:[999999,999999],predicted:[999999,999999]};
    detailed.selection.nested.latest={actual:[999999,999999],predicted:[0,0]};
    expect(selectOrganicForecastResolution(aggregate,detailed)).toEqual(result);
  });
  it('keeps pooling when detailed responses lose or are practically tied',()=>{
    expect(selectOrganicForecastResolution(model([5,5,5]),model([7,7,7])).resolution).toBe('aggregate');
    expect(selectOrganicForecastResolution(model([5,5,5]),model([4.95,4.95,4.95])).resolution).toBe('aggregate');
  });
  it('does not compare different outcomes, overlapping folds, missing scores, or a failed fit',()=>{
    const a=model([10,10,10]),b=model([2,2,2]);
    b.selection.nested.developmentFolds[0].actual[0]=999;
    expect(selectOrganicForecastResolution(a,b)).toMatchObject({resolution:'aggregate',comparable:false,detailedWmape:null});
    const overlap=model([2,2,2]);overlap.selection.nested.developmentFolds[1].offset=3;
    expect(selectOrganicForecastResolution(overlap,overlap).comparable).toBe(false);
    expect(selectOrganicForecastResolution(a,model([1,1])).comparable).toBe(false);
    expect(selectOrganicForecastResolution(a,{...model([1,1,1]),run:null}).resolution).toBe('aggregate');
    expect(selectOrganicForecastResolution(a,{})).toMatchObject({resolution:'aggregate',comparable:false});
  });
});
