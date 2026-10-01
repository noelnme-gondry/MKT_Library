import { describe, it, expect } from 'vitest';
import { forecastValidationSummary, forecastPathSummary } from './forecastAccuracy';

describe('forecast accuracy readouts', () => {
  it('measures only held-out weeks with explicit error direction and an independent baseline', () => {
    const actual = [9000, 100, 80, 50];
    const predicted = [1, 100, 90, 80];
    const result = forecastValidationSummary({actual, predicted, validationStartIndex:1, lastValueBaseline:[100,100,100,100]});
    expect(result.actualChange).toBe(-50);
    expect(result.predictedChange).toBeCloseTo(-20);
    expect(result.meanError).toBeCloseTo(40/3);
    expect(result.wmape).toBeCloseTo(40/230*100);
    expect(result.baselineWmape).toBeCloseTo(70/230*100);
  });
  it('does not turn unavailable percentages or invalid values into zero accuracy', () => {
    expect(forecastValidationSummary({actual:[1,2],predicted:[1,NaN]})).toBeNull();
    expect(forecastValidationSummary({actual:[1,2],predicted:[1]})).toBeNull();
    expect(forecastValidationSummary({actual:[0,0],predicted:[1,1]})).toMatchObject({actualChange:null,wmape:null,baselineWmape:null});
    expect(forecastValidationSummary({actual:[10,20],predicted:[10,20],lastValueBaseline:[10]}).baselineWmape).toBeNull();
  });
  it('describes flat predictions separately from actual budget-path constancy', () => {
    expect(forecastPathSummary({predFut:[100,100],futSpendByKey:{a:[50,50]}})).toEqual({minimum:100,maximum:100,rangePercent:0,constantBudgets:true});
    expect(forecastPathSummary({predFut:[90,110],futSpendByKey:{a:[50,60]}})).toEqual({minimum:90,maximum:110,rangePercent:20,constantBudgets:false});
    expect(forecastPathSummary({predFut:[0,0]})).toMatchObject({rangePercent:null,constantBudgets:false});
    expect(forecastPathSummary({predFut:[NaN]})).toBeNull();
  });
});
