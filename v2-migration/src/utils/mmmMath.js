import { CREATIVE_MATH, CREATIVE_STATS } from "./creativeMath.js";
import { CANNIBAL_STATS } from "./responseMath.js";
import { mmmOls, REG_STATS, REG_TRANSFORMS } from "./regMath.js";
import { _Z975, mmmNormCdf, chi2Cdf, studentTp, studentTcrit } from "./statPrimitives.js";
import { _mmmFmtDate } from "./regForecastMath.js";

            export const MMR_MATH = {
              // 기하 adstock: a_t = x_t + θ·a_{t-1}
              adstock(x, theta) {
                const out = new Array(x.length);
                for (let t = 0; t < x.length; t++)
                  out[t] = (Number(x[t]) || 0) + (t > 0 ? theta * out[t - 1] : 0);
                return out;
              },
              // Hill 포화: x^n / (x^n + K^n) ∈ [0,1). half=반포화점 K, slope=n. (adstocked 값에 적용)
              hill(x, half, slope) {
                half = half > 0 ? half : 1;
                slope = slope > 0 ? slope : 1;
                return x.map((v) => {
                  v = Math.max(0, v);
                  const xn = Math.pow(v, slope);
                  const kn = Math.pow(half, slope);
                  return xn + kn > 0 ? xn / (xn + kn) : 0;
                });
              },
              logSat(x) {
                return x.map((v) => Math.log1p(Math.max(0, v)));
              },
              // Fourier 특성: period(주) 기준 K쌍의 [sin,cos]. t = 0..n-1
              fourier(n, period, K) {
                const cols = [];
                for (let k = 1; k <= K; k++) {
                  const s = [],
                    c = [];
                  for (let t = 0; t < n; t++) {
                    const a = (2 * Math.PI * k * t) / period;
                    s.push(Math.sin(a));
                    c.push(Math.cos(a));
                  }
                  cols.push({ name: `sin${k}_${period}w`, col: s });
                  cols.push({ name: `cos${k}_${period}w`, col: c });
                }
                return cols;
              },
              zscore(x) {
                const m = x.reduce((a, b) => a + b, 0) / x.length;
                const sd =
                  Math.sqrt(
                    x.reduce((a, v) => a + (v - m) ** 2, 0) /
                      Math.max(1, x.length - 1),
                  ) || 1;
                return { z: x.map((v) => (v - m) / sd), mean: m, sd };
              },
            };

            export const MMR_STATS = {
              // OLS (정규방정식). X: n×p (intercept 포함), y: n. 반환 {beta, resid, fitted, XtXinv, n, p, r2, adjR2}
              ols(X, y) {
                const n = X.length,
                  p = X[0].length;
                if (n <= p) return null;
                const Xt = CREATIVE_MATH.transpose(X);
                const XtX = CREATIVE_MATH.matmul(Xt, X);
                const XtXinv = CREATIVE_MATH.inverse(XtX);
                if (!XtXinv) return null;
                const ycol = y.map((v) => [v]);
                const Xty = CREATIVE_MATH.matmul(Xt, ycol);
                const betaCol = CREATIVE_MATH.matmul(XtXinv, Xty);
                const beta = betaCol.map((r) => r[0]);
                const fitted = X.map((row) =>
                  row.reduce((s, v, j) => s + v * beta[j], 0),
                );
                const resid = y.map((v, i) => v - fitted[i]);
                const ybar = y.reduce((a, b) => a + b, 0) / n;
                const ssRes = resid.reduce((a, e) => a + e * e, 0);
                const ssTot = y.reduce((a, v) => a + (v - ybar) ** 2, 0);
                const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
                const adjR2 = 1 - ((1 - r2) * (n - 1)) / Math.max(1, n - p);
                return { beta, resid, fitted, XtXinv, n, p, r2, adjR2, ssRes };
              },
              // Newey-West HAC 표준오차 (Bartlett kernel). L 미지정 시 NW rule.
              neweyWest(X, y, L) {
                const fit = this.ols(X, y);
                if (!fit) return null;
                const { beta, resid, XtXinv, n, p } = fit;
                if (L == null)
                  L = Math.max(1, Math.floor(4 * Math.pow(n / 100, 2 / 9)));
                // meat = Σ e_t² x_t x_t' + Σ_{l=1}^L w_l Σ_{t>l} e_t e_{t-l}(x_t x_{t-l}' + x_{t-l} x_t')
                const meat = Array.from({ length: p }, () => new Array(p).fill(0));
                const addOuter = (xa, xb, scale) => {
                  for (let i = 0; i < p; i++)
                    for (let j = 0; j < p; j++) meat[i][j] += scale * xa[i] * xb[j];
                };
                for (let t = 0; t < n; t++) addOuter(X[t], X[t], resid[t] * resid[t]);
                for (let l = 1; l <= L; l++) {
                  const w = 1 - l / (L + 1);
                  for (let t = l; t < n; t++) {
                    const ee = w * resid[t] * resid[t - l];
                    addOuter(X[t], X[t - l], ee);
                    addOuter(X[t - l], X[t], ee);
                  }
                }
                // cov = XtXinv · meat · XtXinv
                const tmp = CREATIVE_MATH.matmul(XtXinv, meat);
                const cov = CREATIVE_MATH.matmul(tmp, XtXinv);
                const se = beta.map((_, j) => Math.sqrt(Math.max(0, cov[j][j])));
                const tstat = beta.map((b, j) => (se[j] > 0 ? b / se[j] : 0));
                const pval = tstat.map(
                  (t) => 2 * (1 - CREATIVE_STATS.stdNormalCdf(Math.abs(t))),
                );
                const ci95 = beta.map((b, j) => [b - 1.96 * se[j], b + 1.96 * se[j]]);
                return {
                  beta,
                  se,
                  tstat,
                  pval,
                  ci95,
                  resid,
                  r2: fit.r2,
                  adjR2: fit.adjR2,
                  n,
                  p,
                  L,
                };
              },
              durbinWatson(resid) {
                let num = 0,
                  den = 0;
                for (let t = 1; t < resid.length; t++)
                  num += (resid[t] - resid[t - 1]) ** 2;
                for (let t = 0; t < resid.length; t++) den += resid[t] * resid[t];
                return den > 0 ? num / den : null;
              },
              // Breusch-Godfrey LM 검정 (lag p). resid를 [X, lagged resid]에 회귀 → n·R² ~ chi2(p)
              breuschGodfrey(resid, X, p) {
                const n = resid.length;
                const aug = [];
                const yb = [];
                for (let t = 0; t < n; t++) {
                  const row = X[t].slice();
                  for (let l = 1; l <= p; l++)
                    row.push(t - l >= 0 ? resid[t - l] : 0);
                  aug.push(row);
                  yb.push(resid[t]);
                }
                const fit = this.ols(aug, yb);
                if (!fit) return null;
                const LM = n * fit.r2;
                const pValue = 1 - chi2Cdf(LM, p);
                return { LM, df: p, pValue };
              },
              // detrend+deseasonalize 잔차 (prewhitening): y ~ [1, t, fourier(52w,2)]
              prewhitenResiduals(y, period = 52, K = 2) {
                const n = y.length;
                const X = [];
                const f = MMR_MATH.fourier(n, period, K);
                for (let t = 0; t < n; t++) {
                  const row = [1, t];
                  for (const fc of f) row.push(fc.col[t]);
                  X.push(row);
                }
                const fit = this.ols(X, y);
                return fit ? fit.resid : y.slice();
              },
              rmse(actual, pred) {
                let s = 0,
                  c = 0;
                for (let i = 0; i < actual.length; i++)
                  if (isFinite(actual[i]) && isFinite(pred[i])) {
                    s += (actual[i] - pred[i]) ** 2;
                    c++;
                  }
                return c > 0 ? Math.sqrt(s / c) : null;
              },
              mape(actual, pred) {
                let s = 0,
                  c = 0;
                for (let i = 0; i < actual.length; i++)
                  if (actual[i] !== 0 && isFinite(actual[i]) && isFinite(pred[i])) {
                    s += Math.abs((actual[i] - pred[i]) / actual[i]);
                    c++;
                  }
                return c > 0 ? (s / c) * 100 : null;
              },
              // rolling-origin OOS: 최소 minTrain부터 1-step씩 확장, 각 fold에서 다음 점 예측 RMSE
              rollingOriginRMSE(X, y, minTrain) {
                minTrain =
                  minTrain || Math.max(X[0].length + 2, Math.floor(y.length * 0.6));
                const preds = [],
                  acts = [];
                for (let cut = minTrain; cut < y.length; cut++) {
                  const fit = this.ols(X.slice(0, cut), y.slice(0, cut));
                  if (!fit) continue;
                  const yhat = X[cut].reduce((s, v, j) => s + v * fit.beta[j], 0);
                  preds.push(yhat);
                  acts.push(y[cut]);
                }
                return {
                  rmse: this.rmse(acts, preds),
                  mape: this.mape(acts, preds),
                  folds: preds.length,
                };
              },
            };

            export function _mkScore(x) {
              let s = 0,
                n = x.length;
              for (let k = 0; k < n - 1; k++)
                for (let j = k + 1; j < n; j++) s += Math.sign(x[j] - x[k]);
              return s;
            }

            export function _mkVarS(x) {
              const n = x.length;
              const counts = new Map();
              for (const v of x) counts.set(v, (counts.get(v) || 0) + 1);
              let tie = 0;
              for (const t of counts.values())
                if (t > 1) tie += t * (t - 1) * (2 * t + 5);
              return (n * (n - 1) * (2 * n + 5) - tie) / 18;
            }

            export function _mkZ(s, varS) {
              if (varS <= 0) return 0;
              if (s > 0) return (s - 1) / Math.sqrt(varS);
              if (s < 0) return (s + 1) / Math.sqrt(varS);
              return 0;
            }

            export function _mkVerdict(z, alpha = 0.05) {
              const p = 2 * (1 - mmmNormCdf(Math.abs(z)));
              const crit = alpha === 0.05 ? _Z975 : 1 - mmmNormCdf(0); // alpha=0.05 고정
              const h = Math.abs(z) > crit;
              const trend =
                z < 0 && h ? "decreasing" : z > 0 && h ? "increasing" : "no trend";
              return { p, h, trend };
            }

            export function _theilSen(x) {
              const n = x.length,
                sl = [];
              for (let i = 0; i < n - 1; i++)
                for (let j = i + 1; j < n; j++) sl.push((x[j] - x[i]) / (j - i));
              sl.sort((a, b) => a - b);
              const m = Math.floor(sl.length / 2);
              return sl.length % 2 ? sl[m] : (sl[m - 1] + sl[m]) / 2;
            }

            export function _rankAvg(x) {
              const n = x.length,
                idx = x.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
              const ranks = new Array(n);
              let i = 0;
              while (i < n) {
                let j = i;
                while (j < n - 1 && idx[j + 1][0] === idx[i][0]) j++;
                const r = (i + j) / 2 + 1;
                for (let k = i; k <= j; k++) ranks[idx[k][1]] = r;
                i = j + 1;
              }
              return ranks;
            }

            export function _mmmAcf(x, nlags) {
              const n = x.length,
                m = x.reduce((a, b) => a + b, 0) / n,
                y = x.map((v) => v - m);
              let c0 = 0;
              for (let t = 0; t < n; t++) c0 += y[t] * y[t];
              const out = [1];
              for (let k = 1; k <= nlags; k++) {
                let s = 0;
                for (let t = k; t < n; t++) s += y[t] * y[t - k];
                out.push(c0 > 0 ? s / c0 : 0);
              }
              return out;
            }

            export function mkOriginal(x) {
              const s = _mkScore(x),
                varS = _mkVarS(x),
                z = _mkZ(s, varS),
                v = _mkVerdict(z);
              return {
                trend: v.trend,
                h: v.h,
                p: v.p,
                z,
                tau: s / (0.5 * x.length * (x.length - 1)),
                s,
                varS,
                slope: _theilSen(x),
              };
            }

            export function mkHamedRao(x, alpha = 0.05, lag = null) {
              const n = x.length,
                s = _mkScore(x);
              let varS = _mkVarS(x);
              const L = lag == null ? n : lag + 1;
              const slope = _theilSen(x);
              const xdet = x.map((v, i) => v - (i + 1) * slope);
              const I = _rankAvg(xdet);
              const acf = _mmmAcf(I, L - 1);
              const interval = _Z975 / Math.sqrt(n); // alpha=0.05
              let sni = 0;
              for (let i = 1; i < L; i++) {
                if (!(acf[i] <= interval && acf[i] >= -interval))
                  sni += (n - i) * (n - i - 1) * (n - i - 2) * acf[i];
              }
              const nns = 1 + (2 / (n * (n - 1) * (n - 2))) * sni;
              varS *= nns;
              const z = _mkZ(s, varS),
                v = _mkVerdict(z, alpha);
              return {
                trend: v.trend,
                h: v.h,
                p: v.p,
                z,
                tau: s / (0.5 * n * (n - 1)),
                s,
                varS,
                slope,
              };
            }

            export function mkSeasonal(x, period) {
              // pad NaN to multiple of period, column = same season; sum S,var over columns
              let s = 0,
                varS = 0;
              for (let col = 0; col < period; col++) {
                const series = [];
                for (let i = col; i < x.length; i += period) series.push(x[i]);
                if (series.length < 2) continue;
                s += _mkScore(series);
                varS += _mkVarS(series);
              }
              const z = _mkZ(s, varS),
                v = _mkVerdict(z);
              return { trend: v.trend, h: v.h, p: v.p, z, s, varS };
            }

            export function _mackinnonpCT(stat) {
              const TAU_MAX = 0.7,
                TAU_MIN = -16.18,
                TAU_STAR = -2.89;
              const SMALL = [3.2512, 1.6047, 0.049588],
                LARGE = [2.5261, 0.61654, -0.37956, -0.060285];
              if (stat > TAU_MAX) return 1.0;
              if (stat < TAU_MIN) return 0.0;
              const coef = stat <= TAU_STAR ? SMALL : LARGE;
              let val = 0;
              for (let i = 0; i < coef.length; i++)
                val += coef[i] * Math.pow(stat, i);
              return mmmNormCdf(val);
            }

            export function adfCT(x) {
              const n0 = x.length;
              let maxlag = Math.ceil(12 * Math.pow(n0 / 100, 0.25));
              maxlag = Math.min(Math.floor(n0 / 2) - 2 - 1, maxlag);
              if (maxlag < 0) maxlag = 0;
              const xdiff = [];
              for (let i = 1; i < n0; i++) xdiff.push(x[i] - x[i - 1]);
              const nd = xdiff.length,
                nobs = nd - maxlag;
              if (nobs < 5) return { stat: NaN, p: NaN, usedlag: 0, nobs };
              const xdshort = [],
                level = [],
                dlags = [];
              for (let k = 1; k <= maxlag; k++) dlags.push([]);
              for (let r = 0; r < nobs; r++) {
                xdshort.push(xdiff[maxlag + r]);
                level.push(x[n0 - nobs - 1 + r]);
                for (let k = 1; k <= maxlag; k++)
                  dlags[k - 1].push(xdiff[maxlag + r - k]);
              }
              const design = (j) => {
                const X = [];
                for (let r = 0; r < nobs; r++) {
                  const row = [1, r + 1, level[r]];
                  for (let k = 0; k < j; k++) row.push(dlags[k][r]);
                  X.push(row);
                }
                return X;
              };
              let best = { aic: Infinity, j: 0 };
              for (let j = 0; j <= maxlag; j++) {
                const f = mmmOls(design(j), xdshort);
                if (f && f.aic < best.aic) best = { aic: f.aic, j };
              }
              const f = mmmOls(design(best.j), xdshort);
              const stat = f.tvalues[2];
              return { stat, p: _mackinnonpCT(stat), usedlag: best.j, nobs };
            }

            export function _kpssAutolag(e, n) {
              const covlags = Math.floor(Math.pow(n, 2 / 9));
              let s0 = 0;
              for (let i = 0; i < n; i++) s0 += e[i] * e[i];
              s0 /= n;
              let s1 = 0;
              for (let i = 1; i <= covlags; i++) {
                let prod = 0;
                for (let t = i; t < n; t++) prod += e[t] * e[t - i];
                prod /= n / 2;
                s0 += prod;
                s1 += i * prod;
              }
              const shat = s1 / s0,
                pwr = 1 / 3;
              return Math.floor(
                1.1447 * Math.pow(shat * shat, pwr) * Math.pow(n, pwr),
              );
            }

            export function kpssCT(x) {
              const n = x.length;
              const X = x.map((_, i) => [1, i + 1]);
              const f = mmmOls(X, x),
                e = f.resid;
              const crit = [0.119, 0.146, 0.176, 0.216],
                pv = [0.1, 0.05, 0.025, 0.01];
              let nlags = _kpssAutolag(e, n);
              nlags = Math.min(nlags, n - 1);
              let cs = 0,
                eta = 0;
              for (let i = 0; i < n; i++) {
                cs += e[i];
                eta += cs * cs;
              }
              eta /= n * n;
              let sh = 0;
              for (let i = 0; i < n; i++) sh += e[i] * e[i];
              for (let i = 1; i <= nlags; i++) {
                let prod = 0;
                for (let t = i; t < n; t++) prod += e[t] * e[t - i];
                sh += 2 * prod * (1 - i / (nlags + 1));
              }
              sh /= n;
              const stat = eta / sh;
              // np.interp(stat, crit(asc), pv(desc)) — 범위 밖 클램프
              let p;
              if (stat <= crit[0]) p = pv[0];
              else if (stat >= crit[crit.length - 1]) p = pv[pv.length - 1];
              else {
                for (let i = 1; i < crit.length; i++) {
                  if (stat <= crit[i]) {
                    const f2 = (stat - crit[i - 1]) / (crit[i] - crit[i - 1]);
                    p = pv[i - 1] + f2 * (pv[i] - pv[i - 1]);
                    break;
                  }
                }
              }
              return { stat, p, nlags };
            }

            export function ljungBox(resid, lags) {
              const n = resid.length,
                acf = _mmmAcf(resid, lags);
              let Q = 0;
              for (let k = 1; k <= lags; k++) Q += (acf[k] * acf[k]) / (n - k);
              Q *= n * (n + 2);
              return { Q, df: lags, p: 1 - chi2Cdf(Q, lags) };
            }

            export function _yuleWalker1(e) {
              // adjusted, demean
              const n = e.length,
                m = e.reduce((a, b) => a + b, 0) / n,
                y = e.map((v) => v - m);
              let r0 = 0;
              for (let t = 0; t < n; t++) r0 += y[t] * y[t];
              r0 /= n;
              let r1 = 0;
              for (let t = 0; t < n - 1; t++) r1 += y[t] * y[t + 1];
              r1 /= n - 1;
              return r0 > 0 ? r1 / r0 : 0;
            }

            export function fitAR1(X, y, maxiter = 10) {
              let f = mmmOls(X, y);
              if (!f) return null;
              let rho = _yuleWalker1(f.resid),
                beta = f.beta;
              let last = null;
              for (let it = 0; it < maxiter; it++) {
                const n = X.length,
                  k = X[0].length;
                const Xw = [],
                  yw = [];
                for (let t = 1; t < n; t++) {
                  yw.push(y[t] - rho * y[t - 1]);
                  Xw.push(X[t].map((v, j) => v - rho * X[t - 1][j]));
                }
                const fw = mmmOls(Xw, yw);
                if (!fw) break;
                last = fw;
                beta = fw.beta;
                // 원공간 잔차로 rho 재추정
                const resid = y.map(
                  (v, i) => v - X[i].reduce((s, xv, j) => s + xv * beta[j], 0),
                );
                const newRho = _yuleWalker1(resid);
                if (Math.abs(newRho - rho) < 1e-6) {
                  rho = newRho;
                  break;
                }
                rho = newRho;
              }
              if (!last) return null;
              const df = last.n - last.k,
                tcrit = studentTcrit(0.95, df);
              return {
                beta: last.beta,
                se: last.se,
                rho,
                df,
                tvalues: last.tvalues,
                pval: last.tvalues.map((t) => studentTp(t, df)),
                ci95: last.beta.map((b, j) => [
                  b - tcrit * last.se[j],
                  b + tcrit * last.se[j],
                ]),
                resid: last.resid,
              };
            }

            export function shapleyR2Exact(y, groups, X) {
              // groups: [{name, cols:[colIdx...]}], X: design (no intercept)
              const G = groups.length;
              const memo = new Map();
              const r2OfMask = (mask) => {
                if (memo.has(mask)) return memo.get(mask);
                const cols = [];
                for (let g = 0; g < G; g++)
                  if (mask & (1 << g)) cols.push(...groups[g].cols);
                let r2;
                if (!cols.length) r2 = 0;
                else {
                  const D = X.map((row) => [1, ...cols.map((c) => row[c])]);
                  const f = mmmOls(D, y);
                  r2 = f ? f.r2 : 0;
                }
                memo.set(mask, r2);
                return r2;
              };
              // factorial 가중
              const fact = [1];
              for (let i = 1; i <= G; i++) fact.push(fact[i - 1] * i);
              const shares = new Array(G).fill(0);
              for (let g = 0; g < G; g++) {
                const others = [...Array(G).keys()].filter((i) => i !== g);
                const M = others.length;
                for (let sub = 0; sub < 1 << M; sub++) {
                  let mask = 0,
                    sz = 0;
                  for (let b = 0; b < M; b++)
                    if (sub & (1 << b)) {
                      mask |= 1 << others[b];
                      sz++;
                    }
                  const w = (fact[sz] * fact[G - sz - 1]) / fact[G];
                  shares[g] += w * (r2OfMask(mask | (1 << g)) - r2OfMask(mask));
                }
              }
              const total = r2OfMask((1 << G) - 1);
              const sum = shares.reduce((a, b) => a + b, 0);
              const rows = groups
                .map((gr, g) => ({
                  driver: gr.name,
                  r2_share: shares[g],
                  pct: sum > 0 ? (shares[g] / sum) * 100 : 0,
                }))
                .sort((a, b) => b.r2_share - a.r2_share);
              return { rows, total };
            }

            export function stlWeekly(values, period = 52, iters = 2) {
              const n = values.length,
                ts = Array.from({ length: n }, (_, i) => i);
              const trendBw = Math.min(0.95, Math.max(0.15, (1.5 * period) / n));
              let trend = new Array(n).fill(0),
                seasonal = new Array(n).fill(0);
              for (let it = 0; it < iters; it++) {
                const detr = values.map((v, i) =>
                  Number.isFinite(trend[i]) ? v - trend[i] : v,
                );
                const seas = new Array(n).fill(0);
                for (let ph = 0; ph < period; ph++) {
                  const idx = [],
                    ys = [];
                  for (let i = ph; i < n; i += period) {
                    if (Number.isFinite(detr[i])) {
                      idx.push(i);
                      ys.push(detr[i]);
                    }
                  }
                  if (!idx.length) continue;
                  if (idx.length < 4) {
                    const m = ys.reduce((a, b) => a + b, 0) / ys.length;
                    for (const i of idx) seas[i] = m;
                  } else {
                    const sm = CANNIBAL_STATS.loess(idx, ys, { bandwidth: 0.75 });
                    for (let j = 0; j < idx.length; j++)
                      seas[idx[j]] = Number.isFinite(sm[j]) ? sm[j] : ys[j];
                  }
                }
                const fin = seas.filter(Number.isFinite),
                  sm0 = fin.reduce((a, b) => a + b, 0) / Math.max(1, fin.length);
                for (let i = 0; i < n; i++) seasonal[i] = (seas[i] || 0) - sm0;
                const deseason = values.map((v, i) => v - seasonal[i]);
                trend = CANNIBAL_STATS.loess(ts, deseason, { bandwidth: trendBw });
              }
              const residual = values.map((v, i) =>
                Number.isFinite(trend[i]) ? v - trend[i] - seasonal[i] : NaN,
              );
              return { trend, seasonal, residual };
            }

            export const MMM_STATS = {
              mmmOls,
              mkOriginal,
              mkHamedRao,
              mkSeasonal,
              adfCT,
              kpssCT,
              ljungBox,
              fitAR1,
              shapleyR2Exact,
              stlWeekly,
              normCdf: mmmNormCdf,
              studentTp,
              studentTcrit,
              theilSen: _theilSen,
            };

            export const MMM_METH_CONFIG = {
              version: "1.4.0",
              // 기본은 연간 1차 조화파만 둔다. 과거의 13주 파형을 무조건 반복하면
              // 매체·이벤트 변동까지 계절성으로 흡수할 수 있으므로, 더 복잡한 모양은
              // rolling holdout에서 이길 때만 아래 후보에서 선택한다.
              seasonalityPeriods: [52.18],
              seasonalityCandidates: [
                { id: "none", periods: [] },
                { id: "annual-1", periods: [52.18] },
                { id: "annual-2", periods: [52.18, 26.09] },
                { id: "annual-3", periods: [52.18, 26.09, 17.39] },
                { id: "annual-4", periods: [52.18, 26.09, 17.39, 13.04] },
              ],
              // 연간 계절성의 존재 여부는 최근 12주 예측 오차로 결정하지 않는다.
              // 두 번째 연간 주기의 대부분을 관측한 전체 이력에서 구조적
              // 계절성을 비교한다. 정확히 104주를 채우지 못한 경계 주간도
              // 사용할 수 있도록 실무 최소값은 96주로 둔다.
              seasonalityMinHistory: 96,
              seasonalityBicThreshold: 6,
              seasonalityComplexityTolerance: 2,
              seasonalityMinLagCorrelation: 0.15,
              adstockGrid: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
              // Empirical-Bayes 효과 신뢰도는 한 변환을 고정하지 않는다. 채널별 α × 반포화점 ×
              // Hill 기울기 후보의 profile posterior를 평균내되, 계산량은 주간 MMM에 맞춘다.
              bayesHalfSaturationQuantiles: [0.4, 0.6, 0.8],
              bayesHillSlopeGrid: [0.6, 0.8, 1.0, 1.4],
              // profile 재적합은 브라우저 메인 스레드에서 실행되므로 채널 수에 따라
              // 균등한 후보 부분집합을 사용해 전체 적합 수를 제한한다.
              bayesMaxProfileCandidates: 48,
              bayesMaxTotalProfileFits: 480,
              bayesMaxPriorProfileFits: 240,
              intervalCalibrationMinN: 8,
              intervalCalibrationCoverage: 0.9,
              cvMinTrain: 40,
              // 매체 계수만 고정값으로 더 세게 누르면 실제 매체 신호도 0으로
              // 수축할 수 있다. 아래 후보 중 시간 순서 holdout 오차가 가장 낮은
              // 값을 선택하되, 차이가 작으면 더 보수적인(큰) penalty를 유지한다.
              mediaPenalty: 4,
              controlPenalty: 0.15,
              mediaPenaltyCandidates: [0.15, 0.5, 1, 2, 4],
              mediaPenaltyMinTrain: 52,
              mediaPenaltyMaxFolds: 3,
              mediaPenaltyHoldoutWeeks: 12,
              defaultLam: 0.6, // cannibalization net elasticity용
              // 국가·연도와 무관한 고정 주차를 실제 명절처럼 넣지 않는다. 레거시
              // 재현이 꼭 필요한 호출부만 useConfiguredLunarWeeks와 lunarWeeks를
              // 함께 명시하며, 앱 기본 입력은 사용자가 매핑한 이벤트 더미만 쓴다.
              useConfiguredLunarWeeks: false,
              // 구조변화는 데이터에 매핑된 step만 사용한다. 특정 서비스의 42/55주
              // 전환점을 모든 국가에 자동 주입하던 레거시 기본값은 제거했다.
              steps: {},
              foldIntoRegime: [], // 자동 삭제 금지; 공선은 진단·budget gate로 처리
              combinedGoogle: ["google_roi", "google_cbua"], // G_Total (sheet/precedence/detrend)
              vifThreshold: 10,
              sparseMinWeeks: 20, // 비-0 주가 이 미만이면 "데이터 부족" (계수 신뢰 불가)
              excludeSparse: false, // ON 시 데이터 부족 채널을 모델에서 제외 (식별 정리; 기본 off=충실)
              hacAutoLag: (n) => Math.floor(4 * Math.pow(n / 100, 2 / 9)),
            };

            export const MMM_CANNIB_RULES = {
              lowSpendPct: 0.25, // ① 저지출 구간 = 채널 spend ≤ p25
              precMinN: 6, // ① 저지출 구간 최소 표본
              precDeclinePct: 10, // ① FOR: 누적 하락 ≥ 10%
              precSlopeP: 0.05, // ① slope 유의 임계 (FOR=유의 하락 / AGAINST=유의 상승)
              detrendFor: -0.1, // ② FOR: detrended r ≥ -0.10 AND 1차차분 r ≥ -0.10
              detrendAgainst: -0.2, // ② AGAINST: detrended r ≤ -0.20 OR 1차차분 r ≤ -0.20
              netP: 0.05, // ③ 유의 임계
              netMaterial: 0.05, // ③ FOR(대안): 95%CI 하한 > -material 이면 의미있는 카니발 배제
              gateVif: 5, // 게이트: VIF ≥ 5
              gateSpendTimeCorr: 0.7, // 게이트: |corr(ln_spend, t)| ≥ 0.7
              gateCiMult: 3, // 게이트: ③ CI폭 ≥ 3×|점추정|
              gateMinN: 30, // 게이트: n < 30
              brandBarFor: 3, // 브랜드 가로채기 채널: FOR=3 AND AGAINST=0 일 때만 잠정 OK
              otherBarFor: 2, // 그 외(prospecting): FOR≥2 AND AGAINST=0
              brandInterceptRe:
                /brand|branded|asa\b|apple.?search|search.?ads|브랜드|검색/i,
            };

            export function mmmIsBrandIntercept(label, kind) {
              return (
                kind === "brand" ||
                MMM_CANNIB_RULES.brandInterceptRe.test(String(label || ""))
              );
            }

            export const MMM_CHANNELS = [
              { key: "google_roi", field: "ch_google_roi", label: "Google ROI" },
              { key: "google_cbua", field: "ch_google_cbua", label: "Google CBUA" },
              { key: "meta", field: "ch_meta", label: "Meta" },
              { key: "tiktok", field: "ch_tiktok", label: "TikTok" },
              { key: "brand", field: "ch_brand", label: "Brand" },
            ];

            export function _mmmChans(panel) {
              const raw = panel.channels
                ? panel.channels
                : MMM_CHANNELS.filter((ch) => panel.ch[ch.key]).map((ch) => ({
                    key: ch.key,
                    label: ch.label,
                    kind: ch.key === "brand" ? "brand" : "perf",
                  }));
              // 키 중복 제거 (colMap 태그모드에서 같은 채널이 두 번 들어오면 표·effects가 중복 렌더되는 버그 방지)
              const seen = new Set(),
                out = [];
              for (const ch of raw) {
                if (seen.has(ch.key)) continue;
                seen.add(ch.key);
                out.push(ch);
              }
              return out;
            }

            export function mmmAdstock(x, lam) {
              const o = [];
              for (let i = 0; i < x.length; i++)
                o.push((isNaN(x[i]) ? 0 : x[i]) + (i > 0 ? lam * o[i - 1] : 0));
              return o;
            }

            export function mmmLnMedia(raw, lam) {
              const missing = raw.map((v) => isNaN(v) || v == null);
              const series = mmmAdstock(
                raw.map((v, i) => (missing[i] ? 0 : v)),
                lam,
              ).map((v) => Math.log1p(v));
              const active = raw
                .map((v, i) => (!missing[i] && v > 0 ? i : -1))
                .filter((i) => i >= 0);
              if (missing.some((x) => x) && active.length > 6) {
                const last8 = active.slice(-8).map((i) => series[i]);
                const fill = last8.reduce((a, b) => a + b, 0) / last8.length;
                return series.map((v, i) => (missing[i] ? fill : v));
              }
              return series;
            }

            export function _mean(a) {
              return a.reduce((x, y) => x + y, 0) / a.length;
            }

            export function _pstd(a) {
              const m = _mean(a);
              return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
            }

            function _mmmInterpolatedQuantile(values, probability) {
              const finite = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
              if (!finite.length) return null;
              const position = Math.max(0, Math.min(finite.length - 1, probability * (finite.length - 1)));
              const lower = Math.floor(position), upper = Math.ceil(position);
              return finite[lower] + (finite[upper] - finite[lower]) * (position - lower);
            }

            // 최근 시간순 holdout에서 실제로 발생한 비대칭 잔차를 미래 구간에 반영한다.
            // MCMC posterior가 아니므로, 표본 부족 시 기존 조건부 Gaussian 구간을 유지한다.
            export function mmmBuildIntervalCalibration(actual, predicted, nominalCoverage = MMM_METH_CONFIG.intervalCalibrationCoverage) {
              const pairs = (actual || []).map((value, index) => ({ value, predicted: predicted?.[index] }))
                .filter((item) => Number.isFinite(item.value) && Number.isFinite(item.predicted));
              const minN = MMM_METH_CONFIG.intervalCalibrationMinN;
              if (pairs.length < minN) return { enabled: false, n: pairs.length, reason: "insufficient-time-ordered-holdout" };
              const residuals = pairs.map((item) => item.value - item.predicted);
              const tail = (1 - nominalCoverage) / 2;
              const lowerResidual = _mmmInterpolatedQuantile(residuals, tail);
              const upperResidual = _mmmInterpolatedQuantile(residuals, 1 - tail);
              if (!Number.isFinite(lowerResidual) || !Number.isFinite(upperResidual)) return { enabled: false, n: pairs.length, reason: "invalid-holdout-residual" };
              return {
                enabled: true,
                n: pairs.length,
                nominalCoverage,
                lowerResidual,
                upperResidual,
                empiricalCoverage: residuals.filter((value) => value >= lowerResidual && value <= upperResidual).length / residuals.length,
                method: "time-ordered-holdout-residual-quantiles",
              };
            }

            export function mmmApplyIntervalCalibration(point, conditionalLo, conditionalHi, calibration) {
              if (!calibration?.enabled) return { lo: conditionalLo, hi: conditionalHi, calibrated: false };
              return {
                lo: Math.min(conditionalLo, point + calibration.lowerResidual),
                hi: Math.max(conditionalHi, point + calibration.upperResidual),
                calibrated: true,
              };
            }

            export function mmmChannelCoverage(panel, cfg) {
              const out = {};
              for (const ch of _mmmChans(panel)) {
                if (!panel.ch[ch.key]) continue;
                const arr = panel.ch[ch.key];
                const finite = arr.filter((v) => isFinite(v));
                const ordered = [...finite].sort((a, b) => a - b);
                const nonzero = finite.filter((v) => v > 0).length;
                const trailingZero = arr.length >= 8 && arr.slice(-8).every((v) => !(v > 0));
                const min = finite.length ? Math.min(...finite) : 0;
                const max = finite.length ? Math.max(...finite) : 0;
                const scale = finite.length ? finite.reduce((sum, value) => sum + Math.abs(value), 0) / finite.length : 0;
                const constantSpend = finite.length > 0 && max - min <= Math.max(1e-8, scale * 1e-6);
                out[ch.key] = {
                  label: ch.label,
                  nonzero,
                  total: arr.length,
                  coverage: nonzero / arr.length,
                  trailingZero,
                  constantSpend,
                  sparse: nonzero < (cfg.sparseMinWeeks || 20),
                  observedMin: min,
                  observedMax: max,
                  observedP95: ordered.length ? ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * 0.95))] : 0,
                };
              }
              return out;
            }

            export function mmmSparseChannels(panel, cfg) {
              const cov = mmmChannelCoverage(panel, cfg),
                s = new Set();
              for (const k in cov) if (cov[k].sparse) s.add(k);
              return s;
            }

            export function _mmmStepSeries(panel, cfg) {
              if (panel.steps && Object.keys(panel.steps).length) return panel.steps; // 사용자 매핑 step 컬럼 (week-threshold 가정 대체)
              const s = {};
              for (const [nm, fw] of Object.entries(cfg.steps || {}))
                s[nm] = panel.week.map((tt) => (tt >= fw ? 1 : 0));
              return s;
            }

            // 업계 installs/매출 같은 외부 level은 우리 KPI와 단위가 다르다. 원시
            // level을 그대로 회귀·기여 분해에 넣으면 "업황이 1만 명을 만들었다"처럼
            // 기준선 레벨을 외부 변수에 잘못 귀속한다. 기하평균 대비 log 변화율로
            // 바꿔 평균 0의 시장 수요 지수로만 사용한다. 따라서 기여는 시장 절대
            // 규모가 아니라, 시장이 평소보다 움직인 만큼 우리 KPI가 변한 추정치다.
            export function mmmExternalRelativeIndex(values, reference = null) {
              const finite = (values || []).filter((value) => Number.isFinite(value));
              const positive = finite.filter((value) => value > 0);
              if (!finite.length) return { values: (values || []).slice(), reference: null, mode: "empty" };
              if (positive.length === finite.length) {
                const logReference = Number.isFinite(reference) && reference > 0
                  ? Math.log(reference)
                  : positive.reduce((sum, value) => sum + Math.log(value), 0) / positive.length;
                const ref = Math.exp(logReference);
                return {
                  values: values.map((value) => Number.isFinite(value) && value > 0 ? Math.log(value) - logReference : NaN),
                  reference: ref,
                  mode: "log-relative",
                };
              }
              const mean = Number.isFinite(reference) ? reference : finite.reduce((sum, value) => sum + value, 0) / finite.length;
              const scale = Math.max(1e-9, Math.abs(mean));
              return {
                values: values.map((value) => Number.isFinite(value) ? (value - mean) / scale : NaN),
                reference: mean,
                mode: "linear-relative",
              };
            }

            function _mmmExternalIndexValue(value, transform) {
              if (!Number.isFinite(value) || !transform || !Number.isFinite(transform.reference)) return NaN;
              if (transform.mode === "log-relative") return value > 0 ? Math.log(value / transform.reference) : NaN;
              return (value - transform.reference) / Math.max(1e-9, Math.abs(transform.reference));
            }

            export function mmmBuildFeatures(panel, cfg, lam, withTrend = true) {
              const t = panel.week,
                n = t.length,
                cols = [],
                names = [];
              const externalTransforms = {};
              const push = (nm, arr) => {
                names.push(nm);
                cols.push(arr);
              };
              cfg.seasonalityPeriods.forEach((P, i) => {
                push(
                  `sin_${i}`,
                  t.map((tt) => Math.sin((2 * Math.PI * tt) / P)),
                );
                push(
                  `cos_${i}`,
                  t.map((tt) => Math.cos((2 * Math.PI * tt) / P)),
                );
              });
              // 흡수(공선) 집합: cfg.absorbed = 다중공선으로 제거할 컬럼 키(채널 key 또는 step 이름). 기본은 step 흡수(캠페인 유지).
              const absorbed = cfg.absorbed || new Set(cfg.foldIntoRegime || []);
              // 휴일/이벤트: 사용자가 매핑한 더미(panel.useDummies)가 있으면 그것을 모델에 포함(실제 이벤트 신호 — liveness 등).
              // 고정 주차 명절은 국가·연도에 따라 틀릴 수 있으므로 명시적으로
              // useConfiguredLunarWeeks=true인 레거시 재현에서만 사용한다.
              if (
                panel.useDummies &&
                panel.dummy &&
                Object.keys(panel.dummy).length
              ) {
                for (const [nm, arr] of Object.entries(panel.dummy)) {
                  if (absorbed.has("d_" + nm)) continue;
                  push("d_" + nm, arr);
                }
              } else if (cfg.useConfiguredLunarWeeks && cfg.lunarWeeks) {
                const seol = new Set(cfg.lunarWeeks.seollal),
                  chu = new Set(cfg.lunarWeeks.chuseok);
                push(
                  "lny",
                  t.map((tt) => (seol.has(tt) ? 1 : 0)),
                );
                push(
                  "chuseok",
                  t.map((tt) => (chu.has(tt) ? 1 : 0)),
                );
              }
              const steps = _mmmStepSeries(panel, cfg);
              for (const [nm, arr] of Object.entries(steps)) {
                if (absorbed.has(nm)) continue;
                push(nm, arr);
              }
              // 시장 전체 외생 수요는 기준 대비 상대 변화 지수로만 쓴다. 매체
              // 지출이 아니므로 adstock·Hill 변환은 적용하지 않는다.
              for (const [nm, arr] of Object.entries(panel.external || {})) {
                if (absorbed.has("industry_" + nm)) continue;
                const indexed = mmmExternalRelativeIndex(arr);
                externalTransforms[nm] = { reference: indexed.reference, mode: indexed.mode };
                push("industry_" + nm, indexed.values);
              }
              const sparse = cfg.excludeSparse
                ? mmmSparseChannels(panel, cfg)
                : new Set();
              for (const ch of _mmmChans(panel)) {
                if (absorbed.has(ch.key) || sparse.has(ch.key)) continue;
                if (!panel.ch[ch.key]) continue;
                push("ln_" + ch.key, mmmLnMedia(panel.ch[ch.key], lam));
              }
              if (withTrend) {
                const tm = _mean(t),
                  ts = _pstd(t) || 1;
                push(
                  "trend",
                  t.map((tt) => (tt - tm) / ts),
                );
              }
              (cfg.baselineKnots || []).forEach((knot) => {
                const value = Number(knot);
                if (!Number.isFinite(value)) return;
                const scale = _pstd(t) || 1;
                push(`baseline_knot_${value}`, t.map((tt) => Math.max(0, (tt - value) / scale)));
              });
              const X = [];
              for (let i = 0; i < n; i++) X.push(cols.map((c) => c[i]));
              // 랭크 결손 열 드롭(상수=전부-0 채널[예: ASA-Android] · 완전공선) → 다운스트림 mmmOls/fitAR1 특이행렬 방지.
              // 절편 포함 Gram-Schmidt 기준. Tinder/골든은 redundant 없어 전 열 유지 → byte-동일.
              const keep = _nonRedundantCols(X, names);
              if (keep.length === names.length) return { X, names, externalTransforms };
              return {
                X: X.map((r) => keep.map((j) => r[j])),
                names: keep.map((j) => names[j]),
                dropped: names.filter((_, j) => !keep.includes(j)),
                externalTransforms,
              };
            }

            export function mmmSheetDesign(panel, cfg, withBrand = false) {
              const t = panel.week,
                n = t.length,
                cols = [],
                names = [];
              const push = (nm, arr) => {
                names.push(nm);
                cols.push(arr);
              };
              // ln_total = log1p(전체 유료 합산, 브랜드 제외) — "naive lumped" 베이스라인 (시트가 지출을 하나로 뭉친 것을 일반화)
              const lumpKeys = _mmmChans(panel)
                .filter((ch) => ch.kind !== "brand" && panel.ch[ch.key])
                .map((ch) => ch.key);
              const gtot = t.map((_, i) =>
                lumpKeys.reduce((s, k) => s + (panel.ch[k][i] || 0), 0),
              );
              push(
                "ln_total",
                gtot.map((v) => Math.log1p(v)),
              );
              push(
                "sin13",
                t.map((tt) => Math.sin((2 * Math.PI * tt) / 13.0)),
              );
              push(
                "cos52",
                t.map((tt) => Math.cos((2 * Math.PI * tt) / 52.0)),
              );
              // dummies: 매핑된 모든 더미 (Tinder=PreLNY/Seollal/ChuseokOnly/PostChuWk/OtherHol) + LineOff(step). OLS는 순서 무관 → audit 계수 byte-동일.
              for (const k in panel.dummy) push(k, panel.dummy[k]);
              // 구조변화 step: 사용자 매핑 step 컬럼(panel.steps)이 있으면 그것, 아니면 cfg.steps.line_off 주차임계값(Tinder LineOff).
              // Config에서 cfg.steps={}로 비우면(또는 임의데이터에서 미정의) audit 설계행렬에서도 제외 → 둘 다 없으면 step 없음.
              if (panel.steps && Object.keys(panel.steps).length) {
                for (const [nm, arr] of Object.entries(panel.steps)) push(nm, arr);
              } else if (cfg.steps && cfg.steps.line_off != null)
                push(
                  "LineOff",
                  t.map((tt) => (tt >= cfg.steps.line_off ? 1 : 0)),
                );
              push("t", t.slice());
              if (withBrand) {
                // brand-kind 채널 합산 → 0→NaN ffill/bfill → log1p (Tinder: brand 1개 → 기존과 동일)
                const brandKeys = _mmmChans(panel)
                  .filter((c) => c.kind === "brand" && panel.ch[c.key])
                  .map((c) => c.key);
                if (brandKeys.length) {
                  const b = t.map((_, i) =>
                    brandKeys.reduce((s, k) => s + (panel.ch[k][i] || 0), 0),
                  );
                  let last = null;
                  for (let i = 0; i < b.length; i++) {
                    if (b[i] === 0 || isNaN(b[i])) b[i] = last;
                    else last = b[i];
                  }
                  last = null;
                  for (let i = b.length - 1; i >= 0; i--) {
                    if (b[i] == null) b[i] = last;
                    else last = b[i];
                  }
                  push(
                    "ln_Brand",
                    b.map((v) => Math.log1p(v || 0)),
                  );
                }
              }
              const X = [];
              for (let i = 0; i < n; i++) X.push(cols.map((c) => c[i]));
              return { X, names };
            }

            export function _designConst(X) {
              return X.map((r) => [1, ...r]);
            }

            export function mmmFitHac(X, y, cfg) {
              return MMR_STATS.neweyWest(
                _designConst(X),
                y,
                cfg.hacAutoLag(y.length),
              );
            }

            export function _nonRedundantCols(X, names) {
              const n = X.length;
              if (!n) return [];
              const keep = [],
                basis = [];
              const ones = new Array(n).fill(1 / Math.sqrt(n));
              basis.push(ones); // 절편(상수열은 이것과 공선 → 자동 드롭)
              for (let j = 0; j < names.length; j++) {
                const v = X.map((r) => r[j]);
                const norm0 = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
                for (const b of basis) {
                  let d = 0;
                  for (let i = 0; i < n; i++) d += v[i] * b[i];
                  for (let i = 0; i < n; i++) v[i] -= d * b[i];
                }
                const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
                if (norm / norm0 > 1e-8) {
                  for (let i = 0; i < n; i++) v[i] /= norm;
                  basis.push(v);
                  keep.push(j);
                }
              }
              return keep;
            }

            export function mmmFitNamed(X, names, y, cfg, hac) {
              const keep = _nonRedundantCols(X, names);
              const Xk = X.map((r) => keep.map((j) => r[j])),
                nk = keep.map((j) => names[j]);
              const f = hac ? mmmFitHac(Xk, y, cfg) : mmmOls(_designConst(Xk), y);
              const map = {};
              names.forEach((nm) => {
                map[nm] = { coef: 0, p: 1, dropped: !nk.includes(nm) };
              });
              if (f)
                nk.forEach((nm, i) => {
                  const j = i + 1;
                  map[nm] = {
                    coef: f.beta[j],
                    p: hac ? f.pval[j] : studentTp(f.tvalues[j], f.n - f.k),
                    dropped: false,
                  };
                });
              return {
                map,
                fit: f,
                r2: f ? f.r2 : 0,
                adjR2: f ? f.adjR2 : 0,
                n: f ? f.n : y.length,
              };
            }

            export function mmmValidate(panel, locale = "ko", targetName = null) {
              const isEn = locale === "en";
              const rep = { n_weeks: panel.week.length, issues: [], warnings: [] };
              // 매퍼가 원본 날짜/주차 key에서 먼저 찾은 invalid·중복·gap·partial
              // 진단을 내부 t=1…N 정규화 뒤에도 보존한다.
              const diagnosticMessage = (item) => {
                if (typeof item === "string") return item;
                return isEn ? item?.messageEn : item?.messageKo;
              };
              if (panel.timeDiagnostics?.issues?.length) rep.issues.push(...panel.timeDiagnostics.issues.map(diagnosticMessage).filter(Boolean));
              if (panel.timeDiagnostics?.warnings?.length) rep.warnings.push(...panel.timeDiagnostics.warnings.map(diagnosticMessage).filter(Boolean));
              // 주 인덱스 비연속: 개별 나열(@1..@126 폭주) 대신 1건으로 요약. Week 컬럼이 1,2,3..이 아니면(날짜/연도) 흔함 — 행 순서(t)로 분석하므로 경고 수준.
              let nonContig = 0;
              for (let i = 1; i < panel.week.length; i++)
                if (panel.week[i] - panel.week[i - 1] !== 1) nonContig++;
              if (nonContig > 0)
                rep.warnings.push(
                  isEn ? `Week index is not consecutive (${nonContig} gaps) — the Week column may contain dates/years. Analysis uses row order (t=1…N).` : `주 인덱스가 1씩 증가하지 않음(${nonContig}곳) — Week 컬럼이 날짜/연도일 수 있음. 분석은 행 순서(t=1…N)로 진행.`,
                );
              if (panel.calendarGaps?.count > 0) {
                rep.issues.push(
                  isEn
                    ? `${panel.calendarGaps.count} calendar week(s) are missing. Add explicit rows with the correct weekly KPI/spend; carryover and seasonality must not compress time gaps.`
                    : `달력 주차 ${panel.calendarGaps.count}개가 비어 있습니다. 해당 주의 실제 KPI·지출 행을 추가하세요. 잔효·계절 모델은 빈 시간을 압축해 계산하면 안 됩니다.`,
                );
              }
              for (const [nm, arr] of Object.entries(panel.targets)) {
                const missing = arr.filter((value) => !Number.isFinite(value)).length;
                if (missing) {
                  const message = isEn
                    ? `Target '${nm}' has ${missing} missing week(s). Supply the actual weekly value; missing outcomes are not treated as zero.`
                    : `target '${nm}'에 결측 주차가 ${missing}개 있습니다. 실제 주간 값을 채우세요. 결측 성과는 0으로 처리하지 않습니다.`;
                  if (!targetName || nm === targetName) rep.issues.push(message);
                  else rep.warnings.push(message);
                } else if (arr.some((value) => value <= 0)) {
                  rep.warnings.push(isEn ? `Target '${nm}' contains non-positive values` : `target '${nm}' 비양수 값 존재`);
                }
              }
              for (const ch of _mmmChans(panel)) {
                if (!panel.ch[ch.key]) continue;
                const arr = panel.ch[ch.key],
                  nz = arr.filter((v) => v > 0).length,
                  nMiss = arr.filter((v) => isNaN(v) || v == null).length,
                  nNegative = arr.filter((v) => Number.isFinite(v) && v < 0).length;
                rep[`nonzero::${ch.key}`] = `${nz}/${arr.length}`;
                if (nMiss)
                  rep.issues.push(
                    isEn ? `Channel '${ch.key}' has ${nMiss} missing week(s). Enter zero only when there was truly no spend; otherwise supply the actual value.` : `channel '${ch.key}'에 결측 주차가 ${nMiss}개 있습니다. 실제 무집행일 때만 0을 넣고, 그 외에는 실제 지출을 채우세요.`,
                  );
                if (nNegative)
                  rep.issues.push(
                    isEn ? `Channel '${ch.key}' has ${nNegative} negative spend week(s). Spend must be zero or positive; negative values are not treated as no-spend.` : `channel '${ch.key}'에 음수 지출 주차가 ${nNegative}개 있습니다. 지출은 0 이상이어야 하며, 음수를 무집행으로 처리하지 않습니다.`,
                  );
                if (nz === 0)
                  rep.warnings.push(isEn ? `Channel '${ch.key}' is all zero — not identifiable` : `channel '${ch.key}' 전부 0 → 식별 불가`);
                if (arr.length > 6 && arr.slice(-6).every((v) => v === 0) && nz > 6)
                  rep.warnings.push(
                    isEn ? `Channel '${ch.key}': last 6 weeks are zero — check missing vs. true zero` : `channel '${ch.key}': 마지막 6주 0 — 결측-vs-진짜0 확인`,
                  );
              }
              for (const [kind, series] of [["event", panel.dummy || {}], ["regime", panel.steps || {}]]) {
                for (const [key, values] of Object.entries(series)) {
                  const invalid = values.filter((value) => !Number.isFinite(value) || (value !== 0 && value !== 1)).length;
                  if (invalid) rep.issues.push(
                    isEn
                      ? `${kind === "event" ? "Event" : "Regime"} '${key}' has ${invalid} non-binary week(s). Map weekly indicators as exactly 0 or 1.`
                      : `${kind === "event" ? "이벤트" : "구조변화"} '${key}'에 0/1이 아닌 주차가 ${invalid}개 있습니다. 주간 지표는 정확히 0 또는 1로 입력하세요.`,
                  );
                  // step은 전환 뒤의 "상태"를 뜻한다. 한 주짜리 재오픈/런칭
                  // 표식은 지속 효과를 식별하지 못하므로 event dummy가 맞다.
                  // 여기서는 사용자의 명시 매핑을 바꾸지 않고, 잘못된 해석만
                  // 막을 수 있도록 강한 경고를 남긴다.
                  if (kind === "regime" && !invalid) {
                    const onWeeks = values.filter((value) => value === 1).length;
                    if (onWeeks < 2 || values.length - onWeeks < 2) {
                      rep.warnings.push(
                        isEn
                          ? `Regime '${key}' has only ${onWeeks} on-week(s). A regime must be a persistent 0/1 state; map a one-week marker as an event dummy, or provide the post-change state for every week.`
                          : `구조변화 '${key}'의 ON 주차가 ${onWeeks}주뿐입니다. 구조변화는 전환 후 유지되는 0/1 상태여야 합니다. 1주 표식은 이벤트 더미로 매핑하거나, 전환 후 모든 주의 상태값을 입력하세요.`,
                      );
                    }
                  }
                }
              }
              return rep;
            }

            export function mmmAudit(panel, cfg) {
              // 이 진단은 가입+재유입(RR) 전용이다. Traffic·Purchasers·Revenue 등
              // 단위가 다른 다중 Y를 임의로 더해 가짜 composite를 만들지 않는다.
              const RR = panel.targets.RR || (
                panel.targets.Regs && panel.targets.React
                  ? panel.week.map((_, i) => panel.targets.Regs[i] + panel.targets.React[i])
                  : null
              );
              if (!RR) return null;
              const sd = mmmSheetDesign(panel, cfg, false);
              const olsN = mmmFitNamed(sd.X, sd.names, RR, cfg, false);
              const hacN = mmmFitNamed(sd.X, sd.names, RR, cfg, true);
              const coefRows = [
                "ln_total",
                "t",
                "LineOff",
                "Seollal",
                "sin13",
                "cos52",
              ]
                .filter((v) => sd.names.includes(v))
                .map((v) => ({
                  var: v,
                  coef: +olsN.map[v].coef.toFixed(2),
                  ols_p: +olsN.map[v].p.toFixed(4),
                  hac_p: +hacN.map[v].p.toFixed(4),
                }));
              const brandRows = [];
              for (const [nm, y] of [
                ["Regs", panel.targets.Regs],
                ["React", panel.targets.React],
                ["RR", RR],
              ]) {
                if (!y) continue;
                const sd0 = mmmSheetDesign(panel, cfg, false),
                  r0 = mmmFitNamed(sd0.X, sd0.names, y, cfg, false);
                const sdB = mmmSheetDesign(panel, cfg, true),
                  r1 = mmmFitNamed(sdB.X, sdB.names, y, cfg, false);
                brandRows.push({
                  target: nm,
                  R2_no_brand: +r0.r2.toFixed(4),
                  R2_with_brand: +r1.r2.toFixed(4),
                  adjR2_no_brand: +r0.adjR2.toFixed(4),
                  adjR2_with_brand: +r1.adjR2.toFixed(4),
                  brand_p: r1.map.ln_Brand ? +r1.map.ln_Brand.p.toFixed(4) : null,
                });
              }
              const swingRows = [];
              for (const [nm, y] of [
                ["Regs", panel.targets.Regs],
                ["React", panel.targets.React],
                ["RR", RR],
              ]) {
                if (!y) continue;
                const sdc = mmmSheetDesign(panel, cfg, false),
                  m = mmmFitNamed(sdc.X, sdc.names, y, cfg, true);
                swingRows.push({
                  target: nm,
                  ln_G_coef: +m.map.ln_total.coef.toFixed(2),
                  hac_p: +m.map.ln_total.p.toFixed(4),
                  trend_coef: +m.map.t.coef.toFixed(2),
                });
              }
              return {
                target: "RR",
                n: olsN.n,
                r2: +olsN.r2.toFixed(4),
                adj_r2: +olsN.adjR2.toFixed(4),
                hac_maxlags: cfg.hacAutoLag(RR.length),
                coefficients: coefRows,
                brand_test: brandRows,
                channel_swing: swingRows,
                composite: {
                  mean_RR: Math.round(_mean(RR)),
                  components_mean_sum: Math.round(
                    _mean(
                      panel.week.map(
                        (_, i) =>
                          (panel.targets.Regs ? panel.targets.Regs[i] : 0) +
                          (panel.targets.React ? panel.targets.React[i] : 0),
                      ),
                    ),
                  ),
                },
              };
            }

            // 채널 ln(1+지출) ↔ step(구조변화) 계열 상관 |r|≥0.9 공선쌍 탐지. index mmmDetectCollinear 이식(순수).
            export function mmmDetectCollinear(panel, cfg) {
              const pairs = [];
              const chSeries = {};
              for (const ch of _mmmChans(panel))
                if (panel.ch[ch.key])
                  chSeries[ch.key] = mmmLnMedia(panel.ch[ch.key], cfg.defaultLam);
              const stepSeries = _mmmStepSeries(panel, cfg);
              for (const ck of Object.keys(chSeries))
                for (const sk of Object.keys(stepSeries)) {
                  const r = CANNIBAL_STATS.pearson(chSeries[ck], stepSeries[sk]);
                  if (Math.abs(r) >= 0.9)
                    pairs.push({
                      channel: ck,
                      step: sk,
                      corr: +r.toFixed(3),
                      channelLabel:
                        (_mmmChans(panel).find((c) => c.key === ck) || {}).label ||
                        ck,
                    });
                }
              return pairs;
            }

            // 감지된 공선쌍 + 사용자 선택(choice: {`ch__step`:"step"|"channel"}) → 흡수할 컬럼 Set + 노티스.
            // 선택이 없을 때 실제 confounder를 임의로 지우지 않는다. 둘 다 남기고 식별
            // 경고·예산 gate로 처리하며, 명시적으로 선택한 경우에만 한쪽을 흡수한다.
            export function mmmResolveAbsorb(panel, cfg, choice) {
              const pairs = mmmDetectCollinear(panel, cfg);
              const absorbed = new Set();
              const notices = [];
              choice = choice || {};
              for (const p of pairs) {
                const key = `${p.channel}__${p.step}`;
                const side = choice[key] || "none";
                const dropped = side === "step" ? p.step : side === "channel" ? p.channel : null;
                const kept = side === "step" ? p.channelLabel : side === "channel" ? p.step : null;
                if (dropped) absorbed.add(dropped);
                notices.push({
                  key,
                  channel: p.channel,
                  channelLabel: p.channelLabel,
                  step: p.step,
                  corr: p.corr,
                  dropped,
                  kept,
                  side,
                });
              }
              return { absorbed, notices };
            }

            // 모델-독립 매크로 사실 — YoY 2024 vs 2025 (spend·target). dates: 주별 정렬 Date 배열.
            // index mmmMacroFacts 이식(순수). 24/25 둘 다 없으면 {} 반환.
            export function mmmMacroFacts(panel, cfg, dates, locale = "ko") {
              const isEn = locale === "en";
              const out = {};
              if (!dates || !dates.length) return out;
              const years = dates.map((d) => d.getUTCFullYear());
              const has24 = years.includes(2024),
                has25 = years.includes(2025);
              if (!has24 || !has25) return out;
              const sumWhere = (arr, yr) =>
                arr.reduce((s, v, i) => (years[i] === yr ? s + (v || 0) : s), 0);
              const yoy = (arr) => {
                const a = sumWhere(arr, 2024),
                  b = sumWhere(arr, 2025);
                return a > 0 ? +((b / a - 1) * 100).toFixed(1) : null;
              };
              const chKeys = _mmmChans(panel)
                .filter((ch) => panel.ch[ch.key])
                .map((ch) => ch.key);
              const totalPaid = panel.week.map((_, i) =>
                chKeys.reduce((s, k) => s + (panel.ch[k][i] || 0), 0),
              );
              const tp = yoy(totalPaid);
              if (tp != null) out[isEn ? "Total paid spend YoY %" : "전체유료 spend YoY %"] = tp;
              for (const ch of _mmmChans(panel)) {
                if (!panel.ch[ch.key]) continue;
                const v = yoy(panel.ch[ch.key]);
                if (v != null) out[`${ch.label} spend YoY %`] = v;
              }
              for (const [nm, arr] of Object.entries(panel.targets)) {
                const v = yoy(arr);
                if (v != null) out[`${nm} YoY %`] = v;
              }
              return out;
            }

            export function mmmTrendExistence(panel, cfg, targetName, locale = "ko") {
              const isEn = locale === "en";
              const y = panel.targets[targetName];
              const stl = stlWeekly(y, 52);
              const deseason = y.map((v, i) => v - stl.seasonal[i]);
              const mkRaw = mkOriginal(y),
                mkAc = mkHamedRao(y),
                mkSeas = mkSeasonal(y, 52),
                mkDes = mkHamedRao(deseason);
              const adf = adfCT(y),
                kp = kpssCT(y);
              // diff drift (HAC maxlags=6, intercept only)
              const dy = [];
              for (let i = 1; i < y.length; i++) dy.push(y[i] - y[i - 1]);
              const dd = MMR_STATS.neweyWest(
                dy.map(() => [1]),
                dy,
                6,
              );
              // resid after media+season+holidays (no trend term), MK
              const { X } = mmmBuildFeatures(panel, cfg, 0.6, false);
              const fit = mmmOls(_designConst(X), y);
              const residMk = fit ? mkHamedRao(fit.resid) : mkHamedRao(y); // 특이행렬 방어(이론상 mmmBuildFeatures 랭크감소로 안 걸림)
              const stlPct = +(
                ((stl.trend[y.length - 1] - stl.trend[0]) / _mean(y)) *
                100
              ).toFixed(1);
              const assumptionFreeNo =
                mkAc.trend === "no trend" && mkDes.trend === "no trend";
              const organic = residMk.trend !== "no trend";
              const ts = adf.p < 0.05 && kp.p >= 0.05;
              let verdict;
              if (assumptionFreeNo)
                verdict = isEn ? "NO robust trend — fitted t-coefficient is an artifact" : "NO robust trend — fitted t-coefficient는 artifact";
              else if (organic && ts)
                verdict =
                  isEn ? "Trend EXISTS (trend-stationary, not spurious); organic remains after removing media" : "trend EXISTS (trend-stationary, not spurious); media 제거 후에도 organic 잔존";
              else
                verdict = isEn ? "Mixed — trend is small or partly media-confounded" : "mixed — trend는 있으나 작음/부분적으로 media-confounded";
              return {
                target: targetName,
                stl_pct: stlPct,
                mk_raw: [mkRaw.trend, +mkRaw.p.toFixed(4)],
                mk_ac_robust: [mkAc.trend, +mkAc.p.toFixed(4)],
                mk_seasonal: [mkSeas.trend, +mkSeas.p.toFixed(4)],
                mk_deseason: [mkDes.trend, +mkDes.p.toFixed(4)],
                adf_ct_p: +adf.p.toFixed(4),
                kpss_ct_p: +kp.p.toFixed(4),
                diff_drift_per_wk: [+dd.beta[0].toFixed(1), +dd.pval[0].toFixed(4)],
                resid_after_media_mk: [residMk.trend, +residMk.p.toFixed(4)],
                verdict,
                stl,
              };
            }

            export function _mmmPrewhiten(series, withSeason) {
              const X = series.map((_, i) => {
                const row = [1, i];
                if (withSeason) {
                  const a = (2 * Math.PI * i) / 52.18;
                  row.push(Math.sin(a), Math.cos(a));
                }
                return row;
              });
              const fit = REG_STATS.ols(X, series);
              return fit ? fit.resid.slice() : series.slice();
            }

            export function mmmGranger(y, x, maxLagCap, opts) {
              opts = opts || {};
              const method = opts.method || "prewhiten";
              const N = y.length;
              if (N < 24) return null;
              const lx = x.map((v) => Math.log1p(v > 0 ? v : 0));
              let uy, ux;
              if (method === "diff") {
                uy = [];
                ux = [];
                for (let i = 1; i < N; i++) {
                  uy.push(y[i] - y[i - 1]);
                  ux.push(lx[i] - lx[i - 1]);
                }
              } else {
                const ws = N >= 60; // prewhiten: 추세(+계절) 제거 레벨 잔차 — 차분보다 신호 보존
                uy = _mmmPrewhiten(y, ws);
                ux = _mmmPrewhiten(lx, ws);
              }
              const dy = uy,
                dx = ux;
              const M = dy.length,
                maxLag = Math.max(1, Math.min(maxLagCap || 6, Math.floor(M / 12)));
              const fit = (tgt, causes, p) => {
                const rows = [],
                  yv = [];
                for (let t = p; t < M; t++) {
                  const row = [1];
                  for (const s of causes)
                    for (let l = 1; l <= p; l++) row.push(s[t - l]);
                  rows.push(row);
                  yv.push(tgt[t]);
                }
                try {
                  return REG_STATS.ols(rows, yv);
                } catch (e) {
                  return null;
                }
              };
              const test = (tgt, cause) => {
                // does cause Granger-cause tgt?
                let best = null;
                for (let p = 1; p <= maxLag; p++) {
                  const fu = fit(tgt, [tgt, cause], p);
                  if (!fu) continue;
                  const aic = fu.n * Math.log(fu.RSS / fu.n + 1e-12) + 2 * fu.k;
                  if (!best || aic < best.aic) best = { p, aic, fu };
                }
                if (!best) return { lag: 0, F: 0, p: 1, coefSum: 0 };
                const p = best.p,
                  fu = best.fu,
                  fr = fit(tgt, [tgt], p);
                if (!fr) return { lag: p, F: 0, p: 1, coefSum: 0 };
                const q = p,
                  dfd = fu.n - fu.k;
                const F =
                  dfd > 0 && fu.RSS > 0 ? (fr.RSS - fu.RSS) / q / (fu.RSS / dfd) : 0;
                const pval =
                  F > 0 && dfd > 0
                    ? REG_STATS.ibeta(dfd / 2, q / 2, dfd / (dfd + q * F))
                    : 1;
                const coefSum = fu.beta.slice(1 + p).reduce((a, b) => a + b, 0); // cause lag 계수합
                return {
                  lag: p,
                  F: +F.toFixed(2),
                  p: +pval.toFixed(4),
                  coefSum: +coefSum.toFixed(4),
                };
              };
              return {
                spend_to_organic: test(dy, dx),
                organic_to_spend: test(dx, dy),
              };
            }

            export function mmmDeseasonHoliday(panel, target) {
              const y = panel.targets[target] || [];
              const n = y.length;
              if (n < 8) return y.slice();
              const dums = panel.dummy || {},
                steps = panel.steps || {};
              const dumKeys = Object.keys(dums),
                stepKeys = Object.keys(steps);
              const X = y.map((_, i) => {
                const a = (2 * Math.PI * i) / 52.18;
                const row = [1, i, Math.sin(a), Math.cos(a)];
                dumKeys.forEach((k) => row.push((dums[k] || [])[i] || 0));
                stepKeys.forEach((k) => row.push((steps[k] || [])[i] || 0));
                return row;
              });
              let fit;
              try {
                fit = REG_STATS.ols(X, y);
              } catch (e) {
                return y.slice();
              }
              if (!fit) return y.slice();
              const b = fit.beta; // [int, t, sin, cos, ...dummies, ...steps]
              const sh = y.map((_, i) => {
                const a = (2 * Math.PI * i) / 52.18;
                let s = b[2] * Math.sin(a) + b[3] * Math.cos(a);
                dumKeys.forEach((k, j) => {
                  s += b[4 + j] * ((dums[k] || [])[i] || 0);
                });
                return s;
              });
              // 양방향 평탄화 + base(평균) 보존: 계절·휴일 기여의 "평균 대비 편차"만 제거.
              // +기여(평균↑)면 빼서 내리고, −기여(평균↓)면 더해서 올림. 전체 레벨(Base)은 불변.
              const meanSh = sh.reduce((s, v) => s + v, 0) / sh.length;
              return y.map((v, i) => +(v - (sh[i] - meanSh)).toFixed(1));
            }

            export function mmmIRF(y, x, opts) {
              opts = opts || {};
              const H = opts.horizon || 12,
                cap = opts.maxLag || 6;
              const N = y.length;
              if (N < 24) return null;
              const ws = N >= 60;
              const uy = _mmmPrewhiten(y, ws),
                ux = _mmmPrewhiten(
                  x.map((v) => Math.log1p(v > 0 ? v : 0)),
                  ws,
                );
              const M = uy.length;
              const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
              const mx = mean(ux),
                sdx = Math.sqrt(
                  ux.reduce((s, v) => s + (v - mx) ** 2, 0) / ux.length,
                );
              if (!(sdx > 0)) return null;
              const maxLag = Math.max(1, Math.min(cap, Math.floor(M / 12)));
              const fitEq = (tgt, p) => {
                const rows = [],
                  yv = [];
                for (let t = p; t < M; t++) {
                  const r = [1];
                  for (let l = 1; l <= p; l++) r.push(uy[t - l]);
                  for (let l = 1; l <= p; l++) r.push(ux[t - l]);
                  rows.push(r);
                  yv.push(tgt[t]);
                }
                try {
                  return REG_STATS.ols(rows, yv);
                } catch (e) {
                  return null;
                }
              };
              let p = 1,
                best = null;
              for (let pp = 1; pp <= maxLag; pp++) {
                const f = fitEq(uy, pp);
                if (!f) continue;
                const aic = f.n * Math.log(f.RSS / f.n + 1e-12) + 2 * f.k;
                if (!best || aic < best.aic) {
                  best = { aic };
                  p = pp;
                }
              }
              const fy = fitEq(uy, p),
                fx = fitEq(ux, p);
              if (!fy || !fx) return null;
              const ay = fy.beta.slice(1, 1 + p),
                bx = fy.beta.slice(1 + p, 1 + 2 * p); // y eq: 자기lag, x lag
              const cy = fx.beta.slice(1, 1 + p),
                dx = fx.beta.slice(1 + p, 1 + 2 * p); // x eq
              const yH = [],
                xH = [],
                irf = [];
              for (let h = 0; h <= H; h++) {
                let yh, xh;
                if (h === 0) {
                  yh = 0;
                  xh = sdx;
                } // spend-first: 충격은 x에 sdx, organic은 다음 주부터 반응
                else {
                  yh = 0;
                  xh = 0;
                  for (let l = 1; l <= p; l++) {
                    const yv = h - l >= 0 ? yH[h - l] || 0 : 0,
                      xv = h - l >= 0 ? xH[h - l] || 0 : 0;
                    yh += ay[l - 1] * yv + bx[l - 1] * xv;
                    xh += cy[l - 1] * yv + dx[l - 1] * xv;
                  }
                }
                yH[h] = yh;
                xH[h] = xh;
                irf.push(+yh.toFixed(4));
              }
              const cum = [];
              let s = 0;
              irf.forEach((v) => {
                s += v;
                cum.push(+s.toFixed(4));
              });
              let peak = 0,
                peakWk = 0;
              irf.forEach((v, i) => {
                if (Math.abs(v) > Math.abs(peak)) {
                  peak = v;
                  peakWk = i;
                }
              });
              return {
                lag: p,
                horizon: H,
                shockSd: +sdx.toFixed(4),
                irf,
                cum,
                peak: +peak.toFixed(4),
                peakWeek: peakWk,
                cumTotal: +s.toFixed(4),
              };
            }

            export function mmmChangePoints(series, opts) {
              opts = opts || {};
              const minSeg = opts.minSeg || 4,
                mult = opts.penaltyMult != null ? opts.penaltyMult : 2;
              const N0 = (series || []).length;
              if (N0 < 2 * minSeg + 2)
                return {
                  points: [],
                  pointTypes: [],
                  segments: [],
                  outliers: [],
                  dy: [],
                };
              const z = [];
              for (let i = 1; i < N0; i++) z.push(series[i] - series[i - 1]); // Δ(성장률)
              const m = z.length;
              const ps = [0],
                ps2 = [0];
              for (let i = 0; i < m; i++) {
                ps.push(ps[i] + z[i]);
                ps2.push(ps2[i] + z[i] * z[i]);
              }
              const cost = (s, e) => {
                // [s,e) Gaussian -2logL (평균·분산 MLE)
                const len = e - s;
                if (len <= 0) return 0;
                const sum = ps[e] - ps[s],
                  sum2 = ps2[e] - ps2[s];
                let v = (sum2 - (sum * sum) / len) / len;
                if (!(v > 1e-9)) v = 1e-9;
                return len * (Math.log(2 * Math.PI * v) + 1);
              };
              const beta = mult * Math.log(m);
              const F = new Array(m + 1).fill(Infinity),
                prev = new Array(m + 1).fill(0);
              F[0] = -beta;
              for (let t = minSeg; t <= m; t++) {
                for (let s = 0; s <= t - minSeg; s++) {
                  if (F[s] === Infinity) continue;
                  const c = F[s] + cost(s, t) + beta;
                  if (c < F[t]) {
                    F[t] = c;
                    prev[t] = s;
                  }
                }
              }
              const bounds = [];
              let t = m;
              while (t > 0) {
                bounds.push(t);
                t = prev[t];
              }
              bounds.push(0);
              bounds.reverse();
              // z-경계 인덱스 s ↔ series 인덱스 s (그 지점에서 성장률 regime 전환)
              const cps = bounds.slice(1, -1);
              // 세그먼트별 평균 성장률(/주, Δ) + 평균 레벨(원 series) — 해석용
              const segments = [];
              for (let i = 0; i < bounds.length - 1; i++) {
                const s = bounds[i],
                  e = bounds[i + 1],
                  len = e - s;
                const segVals = series.slice(s, Math.min(e + 1, N0));
                const meanLevel =
                  segVals.reduce((a, b) => a + b, 0) / (segVals.length || 1);
                segments.push({
                  startIdx: s,
                  endIdx: e,
                  meanGrowth: +((ps[e] - ps[s]) / len).toFixed(2),
                  meanLevel: +meanLevel.toFixed(1),
                });
              }
              // robust 이상치 탐지 (rolling median window 7 + 전역 MAD) — 1주 spike 분류용
              const half = 3;
              const med = [...series].sort((a, b) => a - b)[Math.floor(N0 / 2)];
              const madArr = series
                .map((v) => Math.abs(v - med))
                .sort((a, b) => a - b);
              const mad = (madArr[Math.floor(N0 / 2)] || 0) * 1.4826 + 1e-9;
              const outliers = [];
              for (let i = 0; i < N0; i++) {
                const w = series
                  .slice(Math.max(0, i - half), Math.min(N0, i + half + 1))
                  .sort((a, b) => a - b);
                const mwin = w[Math.floor(w.length / 2)];
                const zsc = Math.abs(series[i] - mwin) / mad;
                if (zsc > 3) outliers.push({ idx: i, z: +zsc.toFixed(1) });
              }
              const outIdx = new Set(outliers.map((o) => o.idx));
              // 변화점 분류: 인근(±2주)에 이상치 주가 있으면 spike(일시), 아니면 shift(추세전환)
              const pointTypes = cps.map((s) => {
                for (let d = -2; d <= 2; d++) if (outIdx.has(s + d)) return "spike";
                return "shift";
              });
              return { points: cps, pointTypes, segments, outliers, dy: z };
            }

            export function mmmChangePointDrivers(panel, target, cp, opts) {
              opts = opts || {};
              const W = opts.window || 4;
              const y = panel.targets[target] || [],
                wk = panel.week || [],
                N = y.length;
              const chans = _mmmChans(panel).filter((ch) => panel.ch[ch.key]);
              const outIdx = new Set((cp.outliers || []).map((o) => o.idx));
              const mean = (a) =>
                a.length
                  ? a.reduce((s, v) => s + (isFinite(v) ? v : 0), 0) / a.length
                  : NaN;
              return (cp.points || []).map((idx, k) => {
                const lo = Math.max(0, idx - W),
                  hi = Math.min(N, idx + W);
                const tb = mean(y.slice(lo, idx)),
                  ta = mean(y.slice(idx, hi));
                const channels = chans
                  .map((ch) => {
                    const sp = panel.ch[ch.key] || [];
                    const sb = mean(sp.slice(lo, idx)),
                      sa = mean(sp.slice(idx, hi));
                    const pct = sb > 0 ? ((sa - sb) / sb) * 100 : sa > 0 ? 100 : 0;
                    return {
                      key: ch.key,
                      label: ch.label,
                      before: sb,
                      after: sa,
                      delta: sa - sb,
                      pct,
                    };
                  })
                  .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
                const events = [];
                const dums = panel.dummy || {};
                for (const dn in dums) {
                  let act = 0;
                  for (let i = lo; i < hi; i++) if (dums[dn][i]) act++;
                  if (act > 0) events.push(dn);
                }
                return {
                  idx,
                  week: wk[idx],
                  type: cp.pointTypes[k],
                  isOutlier: outIdx.has(idx),
                  targetBefore: +tb.toFixed(1),
                  targetAfter: +ta.toFixed(1),
                  targetDelta: +(ta - tb).toFixed(1),
                  targetPct: tb > 0 ? +(((ta - tb) / tb) * 100).toFixed(1) : 0,
                  channels,
                  events,
                };
              });
            }

            export function mmmCannibalization(
              panel,
              cfg,
              targetName,
              netElasticity,
              channelKey,
              locale = "ko",
            ) {
              const isEn = locale === "en";
              const R = MMM_CANNIB_RULES;
              const y = panel.targets[targetName],
                t = panel.week,
                n = t.length;
              const chMeta = channelKey
                ? _mmmChans(panel).find((c) => c.key === channelKey) || {}
                : {};
              const chLabel = channelKey ? chMeta.label || channelKey : (isEn ? "Total paid" : "전체 유료");
              const isBrand = channelKey
                ? mmmIsBrandIntercept(chLabel, chMeta.kind)
                : false;
              // 선택 채널의 spend (합산 안 함 — 채널별 개별). channelKey 없으면 전체 합산(레거시).
              const spend = channelKey
                ? panel.ch[channelKey]
                  ? panel.ch[channelKey].map((v) => v || 0)
                  : t.map(() => 0)
                : t.map((_, i) =>
                    _mmmChans(panel)
                      .filter((c) => panel.ch[c.key])
                      .reduce((s, c) => s + (panel.ch[c.key][i] || 0), 0),
                  );

              // ── ① 시간 선행성: 저지출 구간(spend ≤ p25)에서 오가닉 추세 (광고 본격화 前부터 죽었나) ──
              const sortedSp = spend.slice().sort((a, b) => a - b);
              const p25 = sortedSp.length
                ? sortedSp[Math.floor((sortedSp.length - 1) * R.lowSpendPct)]
                : 0;
              const lowIdx = spend
                .map((s, i) => (s <= p25 ? i : -1))
                .filter((i) => i >= 0);
              // 집행 연속성: on/off 전환 수 + 무집행 비율. 산발(flighted)이면 저지출창(=0지출)이 시점 혼재 → 선행성 confounded.
              const _onoff = spend.map((v) => (v > 0 ? 1 : 0));
              let flightTrans = 0;
              for (let i = 1; i < n; i++)
                if (_onoff[i] !== _onoff[i - 1]) flightTrans++;
              const zeroFrac = +(1 - _onoff.reduce((a, b) => a + b, 0) / n).toFixed(
                2,
              );
              const flighted = flightTrans >= 4 && zeroFrac >= 0.2; // ≥2 분리 플라이트 + 무집행 ≥20%
              const lowDegenerate = p25 <= 0; // 저지출창이 0지출 주들(초반 블록이 아니라 흩어지면 시점 혼재)
              let slope = 0,
                slopeP = 1,
                changePct = 0;
              const lowN = lowIdx.length;
              if (lowN >= R.precMinN) {
                const lx = lowIdx.map((i) => t[i]),
                  ly = lowIdx.map((i) => y[i]);
                const fit = mmmOls(
                  lx.map((w) => [1, w]),
                  ly,
                );
                if (fit) {
                  slope = fit.beta[1];
                  slopeP = studentTp(fit.tvalues[1], fit.n - fit.k);
                  const span = Math.max(...lx) - Math.min(...lx),
                    lyM = _mean(ly) || 1;
                  changePct = ((slope * span) / lyM) * 100;
                }
              }
              let precVote;
              if (lowN < R.precMinN) precVote = "ABSTAIN";
              else if (flighted && lowDegenerate)
                precVote = "ABSTAIN"; // 산발 집행·저지출창=0지출 시점혼재 → 선행성 신뢰 불가(degenerate P25)
              else if (
                slope < 0 &&
                slopeP < R.precSlopeP &&
                changePct <= -R.precDeclinePct
              )
                precVote = "FOR";
              else if (slope > 0 && slopeP < R.precSlopeP) precVote = "AGAINST";
              else precVote = "ABSTAIN";
              const precedence = {
                window: "low-spend(≤p25)",
                low_n: lowN,
                p25: Math.round(p25),
                avg_spend: Math.round(_mean(lowIdx.map((i) => spend[i])) || 0),
                kpi_slope_per_wk: +slope.toFixed(1),
                slope_p: +slopeP.toFixed(4),
                kpi_change_over_window_pct: +changePct.toFixed(1),
                vote: precVote,
                declining_pre_ramp: precVote === "FOR",
                flighted,
                low_degenerate: lowDegenerate,
              };

              // ── ② 탈추세·차분 상관 (시간 착시 vs 진짜 음상관) ──
              const lnG = spend.map((v) => Math.log1p(v));
              const raw = CANNIBAL_STATS.pearson(lnG, y);
              const tr = t.map((_, i) => i);
              const gFit = mmmOls(
                  tr.map((i) => [1, i]),
                  lnG,
                ),
                yFit = mmmOls(
                  tr.map((i) => [1, i]),
                  y,
                );
              const det =
                gFit && yFit ? CANNIBAL_STATS.pearson(gFit.resid, yFit.resid) : 0;
              const dlnG = [],
                dy = [];
              for (let i = 1; i < n; i++) {
                dlnG.push(lnG[i] - lnG[i - 1]);
                dy.push(y[i] - y[i - 1]);
              }
              const fd = CANNIBAL_STATS.pearson(dlnG, dy);
              let detVote;
              if (det >= R.detrendFor && fd >= R.detrendFor) detVote = "FOR";
              else if (det <= R.detrendAgainst || fd <= R.detrendAgainst)
                detVote = "AGAINST";
              else detVote = "ABSTAIN";
              const detrend = {
                raw: +raw.toFixed(3),
                detrended: +det.toFixed(3),
                first_diff: +fd.toFixed(3),
                vote: detVote,
                negative_collapses: detVote === "FOR" && raw < 0,
              };

              // ── 역인과(페이싱) 점검: 오가닉 약할 때 방어적으로 예산↑면 ②의 음상관은 오가닉→광고(내생) ──
              const spendTimeCorr = CANNIBAL_STATS.pearson(lnG, tr);
              const reverseRisk = raw < -0.1 && spendTimeCorr > 0.3;

              // ── ③ 순증분 탄력성 (NET) ──
              const coef = netElasticity.coef,
                p = netElasticity.p,
                ciLo = netElasticity.ci_lo,
                ciHi = netElasticity.ci_hi;
              const hasCi = isFinite(ciLo) && isFinite(ciHi);
              let netVote;
              if (!isFinite(coef) || !isFinite(p)) netVote = "ABSTAIN";
              else if (coef >= 0 && p < R.netP) netVote = "FOR";
              else if (hasCi && ciLo > -R.netMaterial)
                netVote = "FOR"; // 의미있는 카니발 배제
              else if (coef < 0 && p < R.netP) netVote = "AGAINST";
              else netVote = "ABSTAIN";

              // ── 검정력 게이트 (CLEAR 차단): 하나라도 걸리면 ③ 자동 ABSTAIN + 판정 상한 INCONCLUSIVE ──
              const gateReasons = [];
              if (Math.abs(spendTimeCorr) >= R.gateSpendTimeCorr)
                gateReasons.push(
                  isEn ? `Spend↔time collinear |r|=${Math.abs(spendTimeCorr).toFixed(2)} ≥ ${R.gateSpendTimeCorr}` : `spend↔시간 공선 |r|=${Math.abs(spendTimeCorr).toFixed(2)} ≥ ${R.gateSpendTimeCorr}`,
                );
              const vif = netElasticity.vif;
              if (isFinite(vif) && vif >= R.gateVif)
                gateReasons.push(`VIF=${(+vif).toFixed(1)} ≥ ${R.gateVif}`);
              if (
                hasCi &&
                isFinite(coef) &&
                Math.abs(coef) > 1e-9 &&
                ciHi - ciLo >= R.gateCiMult * Math.abs(coef)
              )
                gateReasons.push(
                  isEn ? `③ CI width ${(ciHi - ciLo).toFixed(3)} ≥ ${R.gateCiMult}×|point estimate|` : `③ CI폭 ${(ciHi - ciLo).toFixed(3)} ≥ ${R.gateCiMult}×|점추정|`,
                );
              if (n < R.gateMinN) gateReasons.push(`n=${n} < ${R.gateMinN}`);
              const powerGateBlocked = gateReasons.length > 0;
              if (powerGateBlocked) netVote = "ABSTAIN";
              const net = {
                net_elasticity: +(isFinite(coef) ? coef : NaN).toFixed(4),
                p: +(isFinite(p) ? p : NaN).toFixed(4),
                ci_lo: hasCi ? +ciLo.toFixed(4) : null,
                ci_hi: hasCi ? +ciHi.toFixed(4) : null,
                vote: netVote,
              };

              // ── ④ 그랜저 인과 (시차·방향) — 동시점 검정이 못 보는 lagged 신호 ──
              const gr = mmmGranger(y, spend, 6);
              const grP = R.netP;
              const grangerCannibal =
                gr && gr.spend_to_organic.p < grP && gr.spend_to_organic.coefSum < 0; // 광고비→오가닉 시차 하락
              const grangerHelp =
                gr && gr.spend_to_organic.p < grP && gr.spend_to_organic.coefSum > 0; // 광고비→오가닉 시차 상승
              const pacing = gr && gr.organic_to_spend.p < grP; // 오가닉→광고비 (페이싱·역인과)

              // ── 투표 집계 + 채널 prior bar ──
              const votes = { FOR: 0, AGAINST: 0, ABSTAIN: 0 };
              [precVote, detVote, netVote].forEach((v) => votes[v]++);
              const forBar = isBrand ? R.brandBarFor : R.otherBarFor;

              // ── 최종 판정 (입증책임 비대칭) ──
              let verdict, verdictClass;
              if (votes.AGAINST >= 1) {
                verdictClass = "cannibal";
                verdict = isEn ? "LEAN CANNIBAL — cannibalization concern; holdout is first priority" : "LEAN CANNIBAL — 카니발 우려, holdout 1순위";
              } else if (
                !powerGateBlocked &&
                votes.FOR >= forBar &&
                votes.AGAINST === 0
              ) {
                verdictClass = "ok";
                verdict = isEn ? "No red flags observed (provisional OK) — likely defensible; confirm with a geo holdout" : "관측상 적색신호 없음 (잠정 OK) — 방어 가능성 높음, 단 결정적 확인은 geo holdout";
              } else {
                verdictClass = "inconclusive";
                verdict = isEn ? "INCONCLUSIVE — insufficient evidence; holdout needed" : "INCONCLUSIVE — 증거 부족, holdout 필요";
              }
              // 그랜저 시차 잠식이 유의하면 비-카니발 판정을 LEAN CANNIBAL로 격상 (동시점이 놓친 신호 — 보수적으로 우려만 ↑)
              // 단, 산발(flighted) 집행이면 그랜저 단독으로 격상 금지(on/off 버스트가 시차 신호를 왜곡 — 매칭 on/off/holdout 필요).
              if (grangerCannibal && verdictClass !== "cannibal" && !flighted) {
                verdictClass = "cannibal";
                verdict = isEn ? `LEAN CANNIBAL — lagged Granger signal (spend→organic↓, lag ${gr.spend_to_organic.lag}); holdout is first priority` : `LEAN CANNIBAL — 그랜저 시차 인과(광고비→오가닉↓, lag ${gr.spend_to_organic.lag}), holdout 1순위`;
              }

              return {
                precedence,
                detrend_corr: detrend,
                net_incrementality: net,
                votes,
                vote_summary: isEn ? `FOR ${votes.FOR} · AGAINST ${votes.AGAINST} · ABSTAIN ${votes.ABSTAIN}` : `FOR ${votes.FOR} · AGAINST ${votes.AGAINST} · ABSTAIN ${votes.ABSTAIN}`,
                power_gate: { blocked: powerGateBlocked, reasons: gateReasons },
                spend_time_corr: +spendTimeCorr.toFixed(3),
                flighted,
                flight_transitions: flightTrans,
                flight_zero_frac: zeroFrac,
                is_brand_intercept: isBrand,
                for_bar: forBar,
                reverse_causality_risk: reverseRisk,
                granger: gr,
                granger_cannibal: !!grangerCannibal,
                granger_help: !!grangerHelp,
                pacing: !!pacing,
                verdict,
                verdict_class: verdictClass,
                organic_votes: votes.FOR, // 하위호환(레거시 소비처)
                channel: channelKey || "__total__",
                channelLabel: chLabel,
              };
            }

            export function _cvPredict(XtrFull, ytr, xrowFull) {
              const k = XtrFull[0].length,
                keep = [0];
              for (let j = 1; j < k; j++) {
                const col = XtrFull.map((r) => r[j]);
                let mn = col[0],
                  mx = col[0];
                for (const v of col) {
                  if (v < mn) mn = v;
                  if (v > mx) mx = v;
                }
                if (mx - mn > 1e-12) keep.push(j);
              }
              const Xtr = XtrFull.map((r) => keep.map((j) => r[j]));
              const f = mmmOls(Xtr, ytr);
              if (!f) return null;
              return keep.reduce((s, j, i) => s + xrowFull[j] * f.beta[i], 0);
            }

            export function mmmSelectAdstock(panel, cfg, targetName) {
              const y = panel.targets[targetName],
                n = y.length,
                grid = cfg.adstockGrid,
                minTrain = cfg.cvMinTrain;
              const results = {};
              for (const lam of grid) {
                const { X } = mmmBuildFeatures(panel, cfg, lam);
                const errs = [];
                for (let cut = minTrain; cut < n - 1; cut++) {
                  const pred = _cvPredict(
                    _designConst(X.slice(0, cut)),
                    y.slice(0, cut),
                    [1, ...X[cut]],
                  );
                  if (pred == null) continue;
                  errs.push((y[cut] - pred) ** 2);
                }
                results[lam] = errs.length ? +Math.sqrt(_mean(errs)).toFixed(1) : NaN;
              }
              let best = grid
                .filter((l) => !isNaN(results[l]))
                .reduce((a, l) => (results[l] < results[a] ? l : a), grid[0]);
              return { cv_rmse: results, best_lambda: best };
            }

            export function mmmShapleyGroups(names, channels) {
              // 휴일=lny/chuseok 또는 매핑 더미(d_*). Regime=cfg.steps + 사용자 매핑 step(나머지 비-계절/추세/휴일/채널).
              // 골든(lny/chuseok·post_step/line_off·ln_*)은 그룹 멤버십·순서 동일 → byte-동일.
              const isSeason = (n) => /^(sin|cos)_/.test(n),
                isHol = (n) => n === "lny" || n === "chuseok" || n.startsWith("d_"),
                isCh = (n) => n.startsWith("ln_");
              const colsWhere = (pred) =>
                names.map((n, i) => (pred(n) ? i : -1)).filter((i) => i >= 0);
              const groups = [
                { name: "Trend", cols: colsWhere((n) => n === "trend") },
                { name: "Seasonality", cols: colsWhere(isSeason) },
                { name: "Holidays", cols: colsWhere(isHol) },
                {
                  name: "Regime(steps)",
                  cols: colsWhere(
                    (n) => n !== "trend" && !isSeason(n) && !isHol(n) && !isCh(n),
                  ),
                },
              ];
              for (const ch of channels || [])
                groups.push({
                  name: ch.label,
                  cols: [names.indexOf("ln_" + ch.key)].filter((i) => i >= 0),
                });
              return groups.filter((g) => g.cols.length);
            }

            export function mmmRunMmm(panel, cfg, targetName) {
              const ad = mmmSelectAdstock(panel, cfg, targetName);
              const lam = ad.best_lambda;
              const { X, names } = mmmBuildFeatures(panel, cfg, lam);
              const y = panel.targets[targetName];
              // VIF (design + const, skip const)
              const vifs = CREATIVE_MATH.vif(_designConst(X));
              const vifByName = names
                .map((nm, i) => ({ var: nm, vif: +vifs[i + 1].toFixed(3) }))
                .sort((a, b) => b.vif - a.vif);
              // collinear pairs (|corr|>=0.85)
              const pairs = [];
              for (let i = 0; i < names.length; i++)
                for (let j = i + 1; j < names.length; j++) {
                  const r = CANNIBAL_STATS.pearson(
                    X.map((row) => row[i]),
                    X.map((row) => row[j]),
                  );
                  if (Math.abs(r) >= 0.85)
                    pairs.push({ a: names[i], b: names[j], corr: +r.toFixed(3) });
                }
              pairs.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
              // elasticities (AR1, log y)
              const elas = mmmElasticities(panel, cfg, targetName, lam);
              // shapley
              const groups = mmmShapleyGroups(names, _mmmChans(panel));
              const sh = shapleyR2Exact(y, groups, X);
              // saturation: 모델에 포함된 첫 perf 채널 (Tinder=google_roi, 임의 데이터=첫 perf) — sat은 골든 호환 유지
              const satCh = _mmmChans(panel).find(
                (c) => c.kind !== "brand" && names.includes("ln_" + c.key),
              );
              const sat = satCh
                ? mmmSaturation(panel, cfg, targetName, satCh.key, lam)
                : null;
              // 채널별 saturation (수확체감 곡선용) — brand·sparse·absorbed·미포함 채널 제외
              const sparseSet = cfg.excludeSparse
                ? mmmSparseChannels(panel, cfg)
                : new Set();
              const satByChannel = {};
              for (const ch of _mmmChans(panel)) {
                if (
                  ch.kind === "brand" ||
                  !panel.ch[ch.key] ||
                  (cfg.absorbed && cfg.absorbed.has(ch.key)) ||
                  sparseSet.has(ch.key) ||
                  !names.includes("ln_" + ch.key)
                )
                  continue;
                const s = mmmSaturation(panel, cfg, targetName, ch.key, lam);
                if (s) {
                  s.label = ch.label;
                  s.recentMean = (() => {
                    const a = panel.ch[ch.key].filter((v) => v > 0 && isFinite(v));
                    return a.length
                      ? Math.round(
                          a.slice(-12).reduce((x, y2) => x + y2, 0) /
                            Math.min(12, a.length),
                        )
                      : 0;
                  })();
                  satByChannel[ch.key] = s;
                }
              }
              return {
                best_lambda: lam,
                cv_rmse: ad.cv_rmse,
                vif: vifByName,
                collinear_pairs: pairs,
                elasticities: elas,
                shapley: sh,
                saturation: sat,
                saturationByChannel: satByChannel,
              };
            }

            export function _mmmLogFitAR1(Xc, yRaw) {
              const idx = [];
              for (let i = 0; i < yRaw.length; i++)
                if (yRaw[i] > 0 && isFinite(yRaw[i])) idx.push(i);
              const fa = fitAR1(
                idx.map((i) => Xc[i]),
                idx.map((i) => Math.log(yRaw[i])),
              );
              return { fa, dropped: yRaw.length - idx.length, n: idx.length };
            }

            export function mmmElasticities(panel, cfg, targetName, lam) {
              const { X, names } = mmmBuildFeatures(panel, cfg, lam, true);
              const fa = _mmmLogFitAR1(_designConst(X), panel.targets[targetName]).fa;
              if (!fa) return []; // 특이행렬(드롭 후 상수열 등) 방어
              const keep = names
                .map((nm, i) => ({ nm, i }))
                .filter((o) => o.nm.startsWith("ln_") || o.nm === "trend");
              return keep.map(({ nm, i }) => {
                const j = i + 1;
                return {
                  var: nm,
                  coef: +fa.beta[j].toFixed(4),
                  ci_lo: +fa.ci95[j][0].toFixed(4),
                  ci_hi: +fa.ci95[j][1].toFixed(4),
                  p: +fa.pval[j].toFixed(4),
                };
              });
            }

            export function mmmSaturation(
              panel,
              cfg,
              targetName,
              channelKey,
              lam,
              levels = [10000, 35000, 60000],
            ) {
              const { X, names } = mmmBuildFeatures(panel, cfg, lam, true);
              const col = "ln_" + channelKey,
                j = names.indexOf(col);
              if (j < 0) return null;
              const fa = fitAR1(_designConst(X), panel.targets[targetName]);
              const b = fa.beta[j + 1];
              const marg = {};
              for (const lv of levels)
                marg[`$${lv / 1000}k`] = +((b / (1 + lv)) * 1000).toFixed(1);
              return {
                channel: channelKey,
                ln_coef: +b.toFixed(1),
                marginal_kpi_per_1k: marg,
              };
            }

            export function mmmChannelEffects(panel, cfg, targetName, lam) {
              const { X, names } = mmmBuildFeatures(panel, cfg, lam, true);
              const logFit = _mmmLogFitAR1(
                _designConst(X),
                panel.targets[targetName],
              ); // 탄력성(log-log) — 타깃≤0 주 제외
              const faLog = logFit.fa;
              const faRaw = fitAR1(_designConst(X), panel.targets[targetName]); // 주당 인원(semi-log)
              const folded = cfg.absorbed || new Set(cfg.foldIntoRegime || []);
              const cov = mmmChannelCoverage(panel, cfg);
              const out = [];
              for (const ch of _mmmChans(panel)) {
                if (folded.has(ch.key) || !panel.ch[ch.key]) continue;
                const cv = cov[ch.key] || {
                  sparse: false,
                  trailingZero: false,
                  nonzero: 0,
                  total: 0,
                };
                const j = names.indexOf("ln_" + ch.key);
                if (j < 0 || !faLog || !faRaw) {
                  // 모델 제외(sparse·랭크드롭) 또는 적합 실패 — 데이터부족 표기
                  out.push({
                    key: ch.key,
                    label: ch.label,
                    elas: 0,
                    ci: [0, 0],
                    p: 1,
                    weeklyPer1k: null,
                    meanSpend: 0,
                    sig: false,
                    nonzero: cv.nonzero,
                    total: cv.total,
                    sparse: true,
                    trailingZero: cv.trailingZero,
                    verdict: "sparse",
                  });
                  continue;
                }
                const elas = faLog.beta[j + 1],
                  ci = faLog.ci95[j + 1],
                  p = faLog.pval[j + 1],
                  bRaw = faRaw.beta[j + 1];
                const active = panel.ch[ch.key].filter((v) => v > 0 && isFinite(v));
                const recentMean = active.length
                  ? active.slice(-12).reduce((a, b) => a + b, 0) /
                    Math.min(12, active.length)
                  : 0;
                const weeklyPer1k =
                  recentMean > 0 ? (bRaw / (1 + recentMean)) * 1000 : null;
                const sig = ci[0] > 0 || ci[1] < 0;
                // 데이터 부족·낮은 커버리지·최근끊김 채널의 음수는 노이즈로 — "잠식 의심"은 데이터 충분+유의한 음수만
                const lowCov = cv.coverage < 0.5;
                let verdict;
                if (cv.sparse) verdict = "sparse";
                else if (!sig) verdict = "noise";
                else if (elas > 0) verdict = "incremental";
                else verdict = cv.trailingZero || lowCov ? "noise" : "suppress";
                out.push({
                  key: ch.key,
                  label: ch.label,
                  elas: +elas.toFixed(4),
                  ci: [+ci[0].toFixed(4), +ci[1].toFixed(4)],
                  p: +p.toFixed(4),
                  weeklyPer1k: weeklyPer1k == null ? null : +weeklyPer1k.toFixed(1),
                  meanSpend: Math.round(recentMean),
                  sig,
                  nonzero: cv.nonzero,
                  total: cv.total,
                  sparse: cv.sparse,
                  trailingZero: cv.trailingZero,
                  verdict,
                });
              }
              out.logDropped = logFit.dropped; // 타깃≤0로 log-log 적합에서 제외된 주 수
              return out;
            }

            export function mmmRidgeFit(X, y, names) {
              const n = X.length,
                k = names.length;
              if (!n || !k) return null;
              const mean = (a) => a.reduce((s, x) => s + x, 0) / n;
              const colM = names.map((_, j) => mean(X.map((r) => r[j])));
              const colS = names.map((_, j) => {
                const m = colM[j];
                return Math.sqrt(mean(X.map((r) => (r[j] - m) ** 2))) || 1;
              });
              const Z = X.map((r) => r.map((v, j) => (v - colM[j]) / colS[j]));
              const ybar = mean(y),
                yc = y.map((v) => v - ybar);
              const ZtZ0 = names.map((_, a) =>
                names.map((__, b) => Z.reduce((s, r) => s + r[a] * r[b], 0)),
              );
              const Zty = names.map((_, a) =>
                Z.reduce((s, r, i) => s + r[a] * yc[i], 0),
              );
              const solve = (lambda) => {
                const A = ZtZ0.map((r, i) => {
                  const row = r.slice();
                  row[i] += lambda;
                  return [...row, Zty[i]];
                });
                for (let c = 0; c < k; c++) {
                  let p = c;
                  for (let r = c + 1; r < k; r++)
                    if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
                  [A[c], A[p]] = [A[p], A[c]];
                  const d = A[c][c] || 1e-9;
                  for (let j = c; j <= k; j++) A[c][j] /= d;
                  for (let r = 0; r < k; r++) {
                    if (r === c) continue;
                    const f = A[r][c];
                    for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
                  }
                }
                const beta = A.map((r, j) => r[k] / colS[j]);
                const b0 = ybar - beta.reduce((s, b, j) => s + b * colM[j], 0);
                return { beta, b0 };
              };
              const grid = [
                0.5, 1, 2, 5, 10, 20, 35, 50, 75, 100, 150, 200, 300, 500, 800, 1200,
              ];
              let chosen = null;
              for (const L of grid) {
                const r = solve(L);
                const maxCh = Math.max(
                  0,
                  ...names.map((nm, j) =>
                    nm.startsWith("ln_") ? r.beta[j] * colM[j] : 0,
                  ),
                );
                if (r.b0 >= 0 && maxCh <= ybar) {
                  chosen = { ...r, lambda: L };
                  break;
                }
              }
              if (!chosen) {
                const L = grid[grid.length - 1];
                chosen = { ...solve(L), lambda: L };
              }
              const fitted = X.map(
                (r) => chosen.b0 + r.reduce((s, v, j) => s + v * chosen.beta[j], 0),
              );
              return {
                beta: chosen.beta,
                b0: chosen.b0,
                lambda: chosen.lambda,
                fitted,
              };
            }

            export function mmmMergedPanel(panel, cfg) {
              const chans = _mmmChans(panel).filter((c) => panel.ch[c.key]);
              if (chans.length < 2) return panel;
              const ln = {};
              chans.forEach(
                (c) => (ln[c.key] = mmmLnMedia(panel.ch[c.key], cfg.defaultLam)),
              );
              const parent = {};
              chans.forEach((c) => (parent[c.key] = c.key));
              const find = (x) =>
                parent[x] === x ? x : (parent[x] = find(parent[x]));
              for (let i = 0; i < chans.length; i++)
                for (let j = i + 1; j < chans.length; j++) {
                  const r = CANNIBAL_STATS.pearson(
                    ln[chans[i].key],
                    ln[chans[j].key],
                  );
                  if (Math.abs(r) >= 0.9)
                    parent[find(chans[i].key)] = find(chans[j].key);
                }
              const groups = {};
              chans.forEach((c) => {
                const g = find(c.key);
                (groups[g] = groups[g] || []).push(c);
              });
              const newCh = {},
                newChannels = [];
              for (const members of Object.values(groups)) {
                if (members.length === 1) {
                  const c = members[0];
                  newCh[c.key] = panel.ch[c.key];
                  newChannels.push({ key: c.key, label: c.label, kind: c.kind });
                } else {
                  const key = "m_" + members.map((m) => m.key).join("_");
                  const label = members.map((m) => m.label).join("+");
                  const kind = members.some((m) => m.kind !== "brand")
                    ? "perf"
                    : "brand";
                  newCh[key] = panel.week.map((_, i) =>
                    members.reduce((s, m) => s + (panel.ch[m.key][i] || 0), 0),
                  );
                  newChannels.push({ key, label, kind });
                }
              }
              return { ...panel, ch: newCh, channels: newChannels };
            }

            export function mmmWeeklyDecomp(panel, cfg, targetName, lam, model) {
              model = model || "ols";
              if (model === "merge") panel = mmmMergedPanel(panel, cfg);
              const { X, names } = mmmBuildFeatures(panel, cfg, lam, true);
              const y = panel.targets[targetName];
              const groups = mmmShapleyGroups(names, _mmmChans(panel));
              const groupNames = groups.map((g) => g.name);
              const ybar = _mean(y);
              let baseline,
                contribOf,
                fittedOf,
                level = false,
                lambda = null;
              if (model === "ridge") {
                const rf = mmmRidgeFit(X, y, names);
                if (!rf) return null;
                baseline = rf.b0;
                level = true;
                lambda = rf.lambda;
                contribOf = (t, g) => {
                  let c = 0;
                  for (const j of g.cols) c += rf.beta[j] * X[t][j];
                  return c;
                }; // LEVEL β·X
                fittedOf = (t) => rf.fitted[t];
              } else {
                const fit = mmmOls(_designConst(X), y);
                if (!fit) return null;
                const colMean = names.map((_, j) => _mean(X.map((r) => r[j])));
                baseline = ybar;
                contribOf = (t, g) => {
                  let c = 0;
                  for (const j of g.cols)
                    c += fit.beta[j + 1] * (X[t][j] - colMean[j]);
                  return c;
                }; // centered
                fittedOf = (t) =>
                  fit.beta[0] + X[t].reduce((s, v, j) => s + v * fit.beta[j + 1], 0);
              }
              const weeks = [];
              for (let t = 0; t < X.length; t++) {
                const contrib = {};
                for (const g of groups) contrib[g.name] = contribOf(t, g);
                const fitted = fittedOf(t);
                weeks.push({
                  week: panel.week[t],
                  actual: y[t],
                  baseline: +baseline.toFixed(1),
                  fitted: +fitted.toFixed(1),
                  residual: +(y[t] - fitted).toFixed(1),
                  contrib,
                });
              }
              const meanContrib = {};
              groupNames.forEach(
                (g) => (meanContrib[g] = _mean(weeks.map((w) => w.contrib[g]))),
              );
              const resids = weeks.map((w) => w.residual);
              const rMean = _mean(resids),
                rStd = Math.sqrt(_mean(resids.map((r) => (r - rMean) ** 2))) || 1;
              const spikes = weeks
                .map((w, i) => {
                  const dev = w.actual - ybar;
                  let domG = null,
                    domV = 0;
                  for (const g of groupNames) {
                    const d = w.contrib[g] - meanContrib[g];
                    if (Math.abs(d) > Math.abs(domV)) {
                      domV = d;
                      domG = g;
                    }
                  } // 평균 대비 편차
                  const unexplained = Math.abs(w.residual) > Math.abs(domV);
                  const cls = unexplained
                    ? "unexplained"
                    : MMM_NONMEDIA_GROUPS.includes(domG)
                      ? "baseline"
                      : "channel";
                  const z = Math.abs(w.residual - rMean) / rStd;
                  return {
                    i,
                    week: w.week,
                    actual: Math.round(w.actual),
                    dev: Math.round(dev),
                    residual: Math.round(w.residual),
                    domDriver: domG,
                    domVal: Math.round(domV),
                    cls,
                    z: +z.toFixed(2),
                  };
                })
                .filter((s) => s.z >= 2)
                .sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual))
                .slice(0, 8);
              // level: avg=평균 level 기여(채널 절대), swing=평균 대비 변동. centered: avg≈0이라 swing이 핵심.
              const driverStats = groupNames
                .map((g) => ({
                  name: g,
                  avg: +_mean(weeks.map((w) => w.contrib[g])).toFixed(1),
                  swing: +_mean(
                    weeks.map((w) => Math.abs(w.contrib[g] - meanContrib[g])),
                  ).toFixed(1),
                  media: !MMM_NONMEDIA_GROUPS.includes(g),
                }))
                .sort((a, b) =>
                  level
                    ? Math.abs(b.avg) + b.swing - (Math.abs(a.avg) + a.swing)
                    : b.swing - a.swing,
                );
              const rmse = Math.sqrt(_mean(weeks.map((w) => w.residual ** 2)));
              const mape =
                _mean(
                  weeks.map((w) => (w.actual ? Math.abs(w.residual / w.actual) : 0)),
                ) * 100;
              return {
                weeks,
                groupNames,
                baseline: +baseline.toFixed(1),
                ybar: +ybar.toFixed(1),
                level,
                model,
                lambda,
                spikes,
                driverStats,
                rmse: +rmse.toFixed(1),
                mape: +mape.toFixed(1),
                rStd: +rStd.toFixed(1),
              };
            }

            export function mmmForecast(
              panel,
              cfg,
              target,
              lam,
              model,
              futureSpend,
              horizon,
              stepOff,
              bandMode,
              locale = "ko",
            ) {
              model = model || "ols";
              bandMode = bandMode || "mean"; // mean=신뢰구간(평균 추세·좁음, t·σ·√h) / pred=예측구간(개별 주·넓음, t·σ·√(1+h))
              const y = panel.targets[target];
              if (!y || !y.length) return null;
              const n = y.length,
                H = Math.max(1, Math.min(260, horizon | 0));
              const chans = _mmmChans(panel).filter((ch) => panel.ch[ch.key]);
              const RN = Math.min(8, n);
              const recentMean = {};
              chans.forEach((ch) => {
                const a = panel.ch[ch.key].slice(-RN).filter((v) => isFinite(v));
                recentMean[ch.key] = a.length
                  ? a.reduce((s, v) => s + v, 0) / a.length
                  : 0;
              });
              const lastWk = panel.week[n - 1];
              const futWeek = Array.from(
                { length: H },
                (_, j) => (isFinite(lastWk) ? lastWk : n) + j + 1,
              );
              const futSpendByKey = {};
              chans.forEach((ch) => {
                const fs = (futureSpend && futureSpend[ch.key]) || null;
                futSpendByKey[ch.key] = Array.from({ length: H }, (_, j) =>
                  fs && isFinite(fs[j]) ? fs[j] : recentMean[ch.key],
                );
              });
              const combined = {
                week: [...panel.week, ...futWeek],
                ch: {},
                dummy: {},
                steps: {},
                targets: {},
                useDummies: panel.useDummies,
              };
              chans.forEach(
                (ch) =>
                  (combined.ch[ch.key] = [
                    ...panel.ch[ch.key],
                    ...futSpendByKey[ch.key],
                  ]),
              );
              // 이벤트/구조변화/휴일더미: 관측 시리즈를 그대로(=비-forecast 파이프라인과 동일) materialize 후
              // 미래는 stepOff[key] 제어 — 빈값=지속(마지막 값·1로 끝난 이벤트는 계속 ON), 숫자 N=N기간 켜둔 뒤 0, N=0=즉시 끔.
              const obsSteps = _mmmStepSeries(panel, cfg);
              const useDum =
                panel.useDummies && panel.dummy && Object.keys(panel.dummy).length;
              const ctl = []; // 제어 대상: step + (useDummies면) 매핑 더미
              Object.keys(obsSteps).forEach((k) =>
                ctl.push({ key: k, kind: "step", obs: obsSteps[k] }),
              );
              if (useDum)
                Object.keys(panel.dummy).forEach((k) =>
                  ctl.push({ key: k, kind: "event", obs: panel.dummy[k] }),
                );
              ctl.forEach((it) => {
                const obs = it.obs,
                  lastV = obs[obs.length - 1] || 0;
                const offN = stepOff ? stepOff[it.key] : null;
                const fut = Array.from({ length: H }, (_, j) =>
                  offN != null && isFinite(offN) ? (j < offN ? lastV : 0) : lastV,
                );
                const full = [...obs, ...fut];
                if (it.kind === "step") combined.steps[it.key] = full;
                else combined.dummy[it.key] = full;
              });
              combined.targets[target] = [...y, ...Array(H).fill(NaN)];
              combined.channels = panel.channels;
              const cpanel =
                model === "merge" ? mmmMergedPanel(combined, cfg) : combined;
              const built = mmmBuildFeatures(cpanel, cfg, lam, true);
              const X = built.X,
                names = built.names;
              const Xobs = X.slice(0, n),
                Xfut = X.slice(n);
              let fittedHist,
                predFut,
                lo = [],
                hi = [],
                sigma,
                beta,
                intercept,
                r2 = 0,
                seArr = null,
                pArr = null;
              const isRidge = model === "ridge";
              if (isRidge) {
                const rf = mmmRidgeFit(Xobs, y, names);
                if (!rf) return null;
                fittedHist = rf.fitted;
                beta = rf.beta;
                intercept = rf.b0;
                predFut = Xfut.map(
                  (r) => rf.b0 + r.reduce((s, v, j) => s + v * rf.beta[j], 0),
                );
                const resid = y.map((v, i) => v - fittedHist[i]),
                  rm = _mean(resid);
                sigma = Math.sqrt(_mean(resid.map((e) => (e - rm) ** 2))) || 1;
                const ssr = resid.reduce((s, e) => s + e * e, 0),
                  ybar = _mean(y),
                  sst = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
                r2 = sst > 0 ? 1 - ssr / sst : 0;
                predFut.forEach((p) => {
                  lo.push(p - 1.96 * sigma);
                  hi.push(p + 1.96 * sigma);
                });
              } else {
                const fit = mmmOls(_designConst(Xobs), y);
                if (!fit) return null;
                fittedHist = fit.fitted;
                beta = fit.beta.slice(1);
                intercept = fit.beta[0];
                sigma = Math.sqrt(fit.sigma2);
                r2 = fit.r2;
                seArr = fit.se;
                pArr = fit.tvalues.map((tv) => studentTp(tv, fit.n - fit.k)); // 계수 편차·p값 (OLS만)
                const tcrit = studentTcrit(0.95, Math.max(1, fit.n - fit.k));
                const lev = (xrow) => {
                  const x = [1, ...xrow];
                  let s = 0;
                  for (let a = 0; a < x.length; a++)
                    for (let b = 0; b < x.length; b++)
                      s += x[a] * fit.XtXinv[a][b] * x[b];
                  return s;
                };
                const noise = bandMode === "pred" ? 1 : 0; // 예측구간은 개별 주 노이즈(+1) 포함, 신뢰구간(평균)은 leverage만
                predFut = Xfut.map(
                  (r) =>
                    fit.beta[0] + r.reduce((s, v, j) => s + v * fit.beta[j + 1], 0),
                );
                Xfut.forEach((r) => {
                  const se = Math.sqrt(Math.max(0, fit.sigma2 * (noise + lev(r))));
                  const p =
                    fit.beta[0] + r.reduce((s, v, j) => s + v * fit.beta[j + 1], 0);
                  lo.push(p - tcrit * se);
                  hi.push(p + tcrit * se);
                });
              }
              // 날짜·라벨 연장
              const gran = panel.granularity;
              let futDates = null,
                futLabels = null;
              if (panel.dates && gran) {
                const last = panel.dates[panel.dates.length - 1];
                if (last) {
                  futDates = Array.from(
                    { length: H },
                    (_, j) =>
                      new Date(last.getTime() + (j + 1) * gran.days * 86400000),
                  );
                  futLabels = futDates.map((d) => _mmmFmtDate(d, gran));
                }
              }
              if (!futLabels) futLabels = futWeek.map((_, j) => "+" + (j + 1));
              const histLabels =
                panel.dateLabel && panel.dateLabel.length === n
                  ? panel.dateLabel
                  : panel.week.map((_, i) => i + 1);
              // 계수표(편차·p값 포함, 절편 먼저) + 설계행렬(엑셀 수식·재료값 칼럼용)
              const coefTable = [
                {
                  term: "(Intercept)",
                  coef: intercept,
                  se: seArr ? seArr[0] : null,
                  p: pArr ? pArr[0] : null,
                },
              ].concat(
                names.map((nm, j) => ({
                  term: nm,
                  coef: beta[j],
                  se: seArr ? seArr[j + 1] : null,
                  p: pArr ? pArr[j + 1] : null,
                })),
              );
              const bandLabel = bandMode === "pred"
                ? (locale === "en" ? "Historical residual reference band (individual week)" : "과거 잔차 참고 범위(개별 주)")
                : (locale === "en" ? "Historical residual reference band (mean trend)" : "과거 잔차 참고 범위(평균 추세)");
              return {
                model,
                lam,
                target,
                horizon: H,
                n,
                names,
                beta,
                intercept,
                isRidge,
                sigma: +sigma.toFixed(2),
                r2: +r2.toFixed(4),
                bandMode,
                bandLabel,
                coefTable,
                featMatrix: X,
                histLabels,
                futLabels,
                labels: [...histLabels, ...futLabels],
                splitAt: n,
                actual: y.slice(),
                fittedHist: fittedHist.map((v) => +v.toFixed(2)),
                predFut: predFut.map((v) => +v.toFixed(2)),
                lo: lo.map((v) => +v.toFixed(2)),
                hi: hi.map((v) => +v.toFixed(2)),
                futWeek,
                futDates,
                gran,
                chans: chans.map((ch) => ({ key: ch.key, label: ch.label })),
                futSpendByKey,
                recentMean,
                histSpendByKey: Object.fromEntries(
                  chans.map((ch) => [ch.key, panel.ch[ch.key]]),
                ),
                steps: ctl.map((it) => ({
                  key: it.key,
                  kind: it.kind,
                  label:
                    (it.kind === "step"
                      ? panel.stepDefs &&
                        (panel.stepDefs.find((s) => s.key === it.key) || {}).label
                      : panel.dummyDefs &&
                        (panel.dummyDefs.find((d) => d.key === it.key) || {})
                          .label) || it.key,
                  lastOn: (it.obs[it.obs.length - 1] || 0) > 0.5,
                })),
                stepOff: { ...(stepOff || {}) },
              };
            }

            export const MMM_NONMEDIA_GROUPS = [
              "Trend",
              "Seasonality",
              "Holidays",
              "Regime(steps)",
              "Holidays & Events",
              "Regime change",
              "Industry Trend",
            ]; // 비매체 드라이버 (baseline 포함 토글 대상)

            // -----------------------------------------------------------------
            // Browser empirical-Bayes MMM (Meridian-inspired)
            // -----------------------------------------------------------------
            // Meridian itself runs NUTS in Python.  The public web tool must keep
            // source CSV in the browser, so this is a conditional Gaussian
            // empirical-Bayes approximation: residual sigma² is plug-in estimated
            // and channel transforms are profile-weighted rather than jointly sampled.
            // It deliberately exposes posterior uncertainty instead of pretending
            // that a point-estimate OLS/Ridge decomposition is causal certainty.
            export function mmmHill(x, ec, slope) {
              if (!(x > 0) || !(ec > 0) || !(slope > 0)) return 0;
              const z = Math.pow(x / ec, slope);
              return z / (1 + z);
            }

            function _mmmQuantile(values, p) {
              const a = values.filter((v) => isFinite(v)).slice().sort((a, b) => a - b);
              if (!a.length) return 1;
              return a[Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))];
            }

            function _mmmBayesControlFeatures(panel, cfg) {
              const built = mmmBuildFeatures(panel, cfg, 0, cfg.includeTrend !== false);
              const keep = built.names
                .map((name, i) => (!name.startsWith("ln_") ? i : -1))
                .filter((i) => i >= 0);
              return {
                names: keep.map((i) => built.names[i]),
                X: built.X.map((row) => keep.map((i) => row[i])),
                externalTransforms: built.externalTransforms || {},
              };
            }

            function _mmmBayesTransformCandidates(raw, cfg) {
              const alphas = cfg.adstockGrid || [0, 0.2, 0.4, 0.6, 0.8];
              const quantiles = cfg.bayesHalfSaturationQuantiles || [0.4, 0.6, 0.8];
              const slopes = cfg.bayesHillSlopeGrid || [0.6, 0.8, 1, 1.4];
              const seen = new Set();
              const candidates = [];
              for (const alpha of alphas) {
                const ad = mmmAdstock(raw, alpha);
                const positive = ad.filter((v) => v > 0 && isFinite(v));
                if (!positive.length) continue;
                for (const q of quantiles) {
                  const ec = _mmmQuantile(positive, q);
                  for (const slope of slopes) {
                    const key = `${alpha}|${ec}|${slope}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    const values = ad.map((v) => mmmHill(v, ec, slope));
                    const mean = _mean(values);
                    const variance = _mean(values.map((v) => (v - mean) ** 2));
                    if (!(variance > 1e-12)) continue;
                    candidates.push({ alpha, ec, slope, values });
                  }
                }
              }
              return candidates;
            }

            function _mmmBayesChannelParams(panel, cfg, targetName, controls) {
              const y = panel.targets[targetName];
              const base = mmmOls(_designConst(controls.X), y);
              const residual = base ? base.resid : y.map((v) => v - _mean(y));
              const params = {};
              for (const ch of _mmmChans(panel)) {
                const raw = panel.ch[ch.key];
                if (!raw) continue;
                let best = null;
                for (const candidate of _mmmBayesTransformCandidates(raw, cfg)) {
                  const score = CANNIBAL_STATS.pearson(candidate.values, residual);
                  // 매체 효과는 0 이상으로 제약한다. 음의 관계를 가장 잘 설명하는
                  // 변환을 택하면 이후 비음수 적합에서 계수가 0으로 막히므로, 양의
                  // 매체 반응을 가장 잘 설명하는 후보만 고른다.
                  const selectionScore = Math.max(0, score);
                  if (!best || selectionScore > best.selectionScore) best = { alpha: candidate.alpha, ec: candidate.ec, slope: candidate.slope, score, selectionScore };
                }
                params[ch.key] = best || { alpha: 0, ec: 1, slope: 0.8, score: 0, selectionScore: 0 };
              }
              return params;
            }

            // Gaussian-prior posterior. 기본 penalty는 약한 regularization이고, 외부
            // 실험 prior의 precision은 실제 계수 단위(1 / variance)다. Gaussian
            // likelihood의 SSE 목적함수에서는 sigma² / priorVariance로 변환해야 하므로
            // residual scale을 먼저 추정한 뒤 한 번 갱신한다.
            // 매체는 실제 집행 수준의 기여(0-spend 대비 level)로 해석하므로, 매체
            // 계수만 0 이상으로 제한한다. 이벤트·계절성·추세는 실제로 성과를 낮출 수
            // 있어 이 제약을 적용하지 않는다.
            function _mmmNonNegativeMediaFit(X, y, mediaIndices, initialBeta) {
              const beta = initialBeta.map((value, index) => mediaIndices.has(index) ? Math.max(0, value) : value);
              const residual = y.map((value, rowIndex) => value - X[rowIndex].reduce((sum, feature, index) => sum + feature * beta[index], 0));
              for (let iteration = 0; iteration < 600; iteration++) {
                let maxChange = 0;
                for (let column = 0; column < beta.length; column++) {
                  let numerator = 0, denominator = 0;
                  for (let row = 0; row < X.length; row++) {
                    const value = X[row][column];
                    residual[row] += value * beta[column];
                    numerator += value * residual[row];
                    denominator += value * value;
                  }
                  const unconstrained = denominator > 1e-12 ? numerator / denominator : beta[column];
                  const next = mediaIndices.has(column) ? Math.max(0, unconstrained) : unconstrained;
                  maxChange = Math.max(maxChange, Math.abs(next - beta[column]));
                  beta[column] = next;
                  for (let row = 0; row < X.length; row++) residual[row] -= X[row][column] * next;
                }
                if (maxChange < 1e-8) break;
              }
              return beta;
            }

            function _mmmBayesianLinear(X, y, mediaIndices, mediaPriors = {}, options = {}) {
              const n = X.length;
              if (!n || !X[0]?.length) return null;
              const p = X[0].length;
              const yScale = Math.sqrt(_mean(y.map((v) => (v - _mean(y)) ** 2))) || 1;
              const mediaPenalty = Number.isFinite(options.mediaPenalty)
                ? Math.max(0, options.mediaPenalty)
                : 4;
              const controlPenalty = Number.isFinite(options.controlPenalty)
                ? Math.max(0, options.controlPenalty)
                : 0.15;
              const defaultPenalty = Array.from({ length: p }, (_, j) =>
                j === 0 ? 1e-8 : mediaIndices.has(j) ? mediaPenalty : controlPenalty,
              );
              const priorMean = Array(p).fill(0);
              const calibratedPrecision = {};
              // 외부 실험·참고 시장 근거는 매체 계수에만 적용한다. 추세·계절·국가
              // 고유 baseline을 다른 시장에서 가져오지 않도록 제어변수 prior는 그대로 둔다.
              for (const [idx, prior] of Object.entries(mediaPriors || {})) {
                const j = Number(idx);
                if (!mediaIndices.has(j) || !prior) continue;
                if (isFinite(prior.mean)) priorMean[j] = prior.mean;
                if (isFinite(prior.precision) && prior.precision > 0) calibratedPrecision[j] = prior.precision;
              }
              const fitWithPenalty = (penalty) => {
                const augX = X.map((r) => r.slice());
                const augY = y.slice();
                for (let j = 0; j < p; j++) {
                  if (!(penalty[j] > 0)) continue;
                  const row = Array(p).fill(0);
                  row[j] = Math.sqrt(penalty[j]);
                  augX.push(row);
                  augY.push(Math.sqrt(penalty[j]) * priorMean[j]);
                }
                const unconstrainedFit = mmmOls(augX, augY);
                if (!unconstrainedFit) return null;
                const beta = _mmmNonNegativeMediaFit(augX, augY, mediaIndices, unconstrainedFit.beta);
                const fitted = X.map((row) => row.reduce((sum, value, j) => sum + value * beta[j], 0));
                const resid = y.map((value, i) => value - fitted[i]);
                const sigma2 = Math.max(
                  yScale ** 2 * 1e-8,
                  resid.reduce((sum, value) => sum + value * value, 0) / Math.max(1, n - p),
                );
                return { fit: { ...unconstrainedFit, beta }, fitted, resid, sigma2 };
              };
              const provisional = fitWithPenalty(defaultPenalty);
              if (!provisional) return null;
              let sigma2ForPrior = provisional.sigma2;
              let result = provisional;
              let priorScaleIterations = 0;
              let priorScaleConverged = !Object.keys(calibratedPrecision).length;
              // prior penalty와 residual sigma²가 서로 의존하므로 고정점까지 반복한다.
              // 이 과정을 통해 outcome 단위를 바꿔도 동일한 상대 prior 강도를 유지한다.
              for (let iteration = 0; !priorScaleConverged && iteration < 6; iteration++) {
                const penalty = defaultPenalty.slice();
                Object.entries(calibratedPrecision).forEach(([idx, precision]) => {
                  penalty[Number(idx)] = sigma2ForPrior * precision;
                });
                const next = fitWithPenalty(penalty);
                if (!next) return null;
                priorScaleIterations = iteration + 1;
                const relativeChange = Math.abs(next.sigma2 - sigma2ForPrior) / Math.max(1e-12, sigma2ForPrior);
                result = next;
                sigma2ForPrior = next.sigma2;
                if (relativeChange <= 1e-5) {
                  priorScaleConverged = true;
                  break;
                }
              }
              const { fit, fitted, resid, sigma2 } = result;
              const beta = fit.beta;
              const sd = beta.map((_, j) => Math.sqrt(Math.max(0, sigma2 * fit.XtXinv[j][j])));
              const r2Den = y.reduce((s, v) => s + (v - _mean(y)) ** 2, 0);
              const r2 = r2Den > 0 ? 1 - resid.reduce((s, e) => s + e * e, 0) / r2Den : 0;
              return {
                beta, fitted, resid, sigma: Math.sqrt(sigma2) || yScale, sigma2, sd, r2,
                XtXinv: fit.XtXinv,
                calibratedPriorCount: Object.keys(calibratedPrecision).length,
                priorScaleIterations,
                priorScaleConverged,
              };
            }

            function _mmmBayesFitColumns(names, cols, channelMeta, y, options = {}) {
              if (!cols.length || !cols[0]?.length) return null;
              const Xraw = y.map((_, i) => cols.map((column) => column[i]));
              const colMean = names.map((_, j) => _mean(Xraw.map((row) => row[j])));
              const colScale = names.map((_, j) =>
                Math.sqrt(_mean(Xraw.map((row) => (row[j] - colMean[j]) ** 2))) || 1,
              );
              const X = Xraw.map((row) => [1, ...row.map((v, j) => (v - colMean[j]) / colScale[j])]);
              const mediaIndices = new Set(
                channelMeta
                  .map((ch) => names.indexOf("media_" + ch.key))
                  .filter((j) => j >= 0)
                  .map((j) => j + 1),
              );
              const mediaPriors = {};
              for (const ch of channelMeta) {
                const j = names.indexOf("media_" + ch.key);
                const prior = options.mediaPriors?.[ch.key];
                if (j < 0 || !prior) continue;
                mediaPriors[j + 1] = {
                  mean: isFinite(prior.mean) ? prior.mean * colScale[j] : 0,
                  // prior는 원래 media feature 단위의 Normal(mean, variance)다.
                  // 회귀는 표준화 feature로 적합하므로 Var(β_std)=Var(β_raw)×scale²,
                  // 즉 precision은 scale²로 나눠야 실험 CI의 강도가 변하지 않는다.
                  precision: isFinite(prior.precision) ? prior.precision / Math.max(1e-12, colScale[j] ** 2) : prior.precision,
                };
              }
              const posterior = _mmmBayesianLinear(X, y, mediaIndices, mediaPriors, options);
              if (!posterior) return null;
              const absoluteBeta = names.map((_, j) => posterior.beta[j + 1] / colScale[j]);
              const absoluteIntercept = posterior.beta[0] - absoluteBeta.reduce(
                (sum, beta, j) => sum + beta * colMean[j],
                0,
              );
              return { Xraw, colMean, colScale, X, posterior, absoluteBeta, absoluteIntercept };
            }

            // 한 번 고른 변환만 믿으면 adstock·포화 가정이 효과 구간에서 사라진다.
            // 각 채널을 제외한 변환은 그대로 둔 profile 모델들을 다시 적합하고,
            // BIC 근사 가중치로 계수 posterior를 섞어 그 불확실성을 효과 신뢰도에 넣는다.
            function _mmmNormalMixtureQuantile(profile, probability) {
              if (!profile.length) return NaN;
              let low = Math.min(...profile.map((item) => item.beta - 8 * Math.max(item.sd, 1e-9)));
              let high = Math.max(...profile.map((item) => item.beta + 8 * Math.max(item.sd, 1e-9)));
              for (let iteration = 0; iteration < 80; iteration++) {
                const middle = (low + high) / 2;
                const cdf = profile.reduce((sum, item) =>
                  sum + item.weight * (item.sd > 0 ? mmmNormCdf((middle - item.beta) / item.sd) : middle >= item.beta ? 1 : 0),
                0);
                if (cdf < probability) low = middle;
                else high = middle;
              }
              return (low + high) / 2;
            }

            function _mmmBayesTransformUncertainty(panel, cfg, names, cols, channelMeta, options = {}) {
              const y = panel.targets[options.targetName];
              const result = {};
              const profiledChannelCount = Math.max(1, channelMeta.filter((channel) => !options.mediaPriors?.[channel.key]).length);
              for (const ch of channelMeta) {
                const colIndex = names.indexOf("media_" + ch.key);
                if (colIndex < 0 || !panel.ch[ch.key]) continue;
                const profile = [];
                const allCandidates = _mmmBayesTransformCandidates(panel.ch[ch.key], cfg);
                // 실험/국가 prior의 mean·variance는 타깃의 대표 변환 단위로 보정돼
                // 있다. 다른 alpha/ec/slope에 같은 숫자를 재사용하면 처리강도가 달라져
                // prior 단위가 깨지므로, 근거가 있는 채널은 그 대표 변환에 고정한다.
                if (options.mediaPriors?.[ch.key]) {
                  const fit = _mmmBayesFitColumns(names, cols, channelMeta, y, options);
                  const params = options.channelParams?.[ch.key];
                  if (fit && params) {
                    // Profile/출력 경로도 매체 절대기여의 비음수 제약을 유지한다.
                    const beta = Math.max(0, fit.absoluteBeta[colIndex]);
                    const sd = fit.posterior.sd[colIndex + 1] / fit.colScale[colIndex];
                    result[ch.key] = {
                      beta,
                      sd,
                      ci: [beta - 1.645 * sd, beta + 1.645 * sd],
                      posteriorPositive: sd > 0 ? mmmNormCdf(beta / sd) : beta > 0 ? 1 : 0,
                      candidateCount: 1,
                      totalCandidateCount: allCandidates.length,
                      candidateSearchCapped: allCandidates.length > 1,
                      priorLockedTransform: true,
                      effectiveCandidateCount: 1,
                      topWeight: 1,
                      models: [{ ...params, beta, sd, weight: 1 }],
                    };
                  }
                  continue;
                }
                const totalFitBudget = Object.keys(options.mediaPriors || {}).length
                  ? (cfg.bayesMaxPriorProfileFits || cfg.bayesMaxTotalProfileFits || Infinity)
                  : (cfg.bayesMaxTotalProfileFits || Infinity);
                const totalFitShare = Math.max(
                  1,
                  Math.floor(totalFitBudget / profiledChannelCount),
                );
                const perChannelCap = Math.max(
                  1,
                  Math.min(cfg.bayesMaxProfileCandidates || allCandidates.length, totalFitShare),
                );
                const candidates = allCandidates.length <= perChannelCap
                  ? allCandidates
                  : Array.from({ length: perChannelCap }, (_, index) =>
                    allCandidates[Math.round((index * (allCandidates.length - 1)) / Math.max(1, perChannelCap - 1))],
                  );
                for (const candidate of candidates) {
                  const candidateCols = cols.slice();
                  candidateCols[colIndex] = candidate.values;
                  const fit = _mmmBayesFitColumns(names, candidateCols, channelMeta, y, options);
                  if (!fit) continue;
                  // Profile/출력 경로도 매체 절대기여의 비음수 제약을 유지한다.
                  const beta = Math.max(0, fit.absoluteBeta[colIndex]);
                  const sd = fit.posterior.sd[colIndex + 1] / fit.colScale[colIndex];
                  const sse = fit.posterior.resid.reduce((sum, value) => sum + value * value, 0);
                  const bic = y.length * Math.log(Math.max(sse / Math.max(1, y.length), 1e-12)) + names.length * Math.log(Math.max(2, y.length));
                  if (!isFinite(beta) || !isFinite(sd) || !isFinite(bic)) continue;
                  profile.push({ alpha: candidate.alpha, ec: candidate.ec, slope: candidate.slope, beta, sd, bic });
                }
                if (!profile.length) continue;
                const minBic = Math.min(...profile.map((item) => item.bic));
                const rawWeights = profile.map((item) => Math.exp(-0.5 * Math.min(700, item.bic - minBic)));
                const weightSum = rawWeights.reduce((sum, weight) => sum + weight, 0) || 1;
                profile.forEach((item, index) => { item.weight = rawWeights[index] / weightSum; });
                const beta = profile.reduce((sum, item) => sum + item.weight * item.beta, 0);
                const variance = Math.max(0, profile.reduce((sum, item) => sum + item.weight * (item.sd ** 2 + item.beta ** 2), 0) - beta ** 2);
                const sd = Math.sqrt(variance);
                // 가중합의 부동소수점 오차로 1.0000000000000002처럼 확률 범위를 벗어나지 않게 한다.
                const posteriorPositive = Math.min(1, Math.max(0, profile.reduce(
                  (sum, item) => sum + item.weight * (item.sd > 0 ? mmmNormCdf(item.beta / item.sd) : item.beta > 0 ? 1 : 0),
                  0,
                )));
                const top = profile.reduce((best, item) => item.weight > best.weight ? item : best, profile[0]);
                result[ch.key] = {
                  beta,
                  sd,
                  // 혼합분포를 정규 한 개로 근사하지 않고 profile posterior CDF의
                  // 5%·95% 분위수를 직접 풀어 비대칭·다봉 후보 불확실성을 보존한다.
                  ci: [_mmmNormalMixtureQuantile(profile, 0.05), _mmmNormalMixtureQuantile(profile, 0.95)],
                  posteriorPositive,
                  candidateCount: profile.length,
                  totalCandidateCount: allCandidates.length,
                  candidateSearchCapped: allCandidates.length > candidates.length,
                  effectiveCandidateCount: 1 / profile.reduce((sum, item) => sum + item.weight ** 2, 0),
                  topWeight: top.weight,
                  models: profile.map(({ alpha, ec, slope, beta: effect, sd: effectSd, weight }) => ({ alpha, ec, slope, beta: effect, sd: effectSd, weight })),
                };
              }
              return result;
            }

            function _mmmBayesBaselineSelection(panel, cfg, targetName, options = {}) {
              const n = panel.week?.length || 0;
              if (!options.enableBaselineSelection || n < 78 || cfg.baselineKnots?.length) return { cfg, selection: null };
              const controls = _mmmBayesControlFeatures(panel, cfg);
              const params = _mmmBayesChannelParams(panel, cfg, targetName, controls);
              const candidates = [[], [panel.week[Math.floor(n * 0.5)]], [panel.week[Math.floor(n / 3)], panel.week[Math.floor((n * 2) / 3)]]];
              const evaluated = candidates.map((knots) => {
                const candidateCfg = { ...cfg, baselineKnots: knots };
                const built = _mmmBayesControlFeatures(panel, candidateCfg);
                const names = built.names.slice();
                const cols = built.X.length ? built.X[0].map((_, j) => built.X.map((row) => row[j])) : [];
                const channels = _mmmChans(panel).filter((ch) => panel.ch[ch.key] && params[ch.key]);
                channels.forEach((ch) => {
                  const p = params[ch.key];
                  names.push("media_" + ch.key);
                  cols.push(mmmAdstock(panel.ch[ch.key], p.alpha).map((value) => mmmHill(value, p.ec, p.slope)));
                });
                const fit = _mmmBayesFitColumns(names, cols, channels, panel.targets[targetName], options);
                if (!fit) return { knots, bic: Infinity };
                const sse = fit.posterior.resid.reduce((sum, value) => sum + value ** 2, 0);
                return { knots, bic: n * Math.log(Math.max(sse / Math.max(1, n), 1e-12)) + (names.length + 1) * Math.log(Math.max(2, n)) };
              }).sort((a, b) => a.bic - b.bic);
              const base = evaluated.find((item) => item.knots.length === 0);
              const best = evaluated[0];
              const selected = !!(base && best && Number.isFinite(base.bic) && Number.isFinite(best.bic) && base.bic - best.bic >= 6 && best.knots.length);
              return {
                cfg: selected ? { ...cfg, baselineKnots: best.knots } : cfg,
                selection: { enabled: true, candidateCount: evaluated.length, selected, selectedKnots: selected ? best.knots : [], baseBic: base?.bic ?? null, bestBic: best?.bic ?? null, reason: selected ? "material-bic-improvement" : "base-retained" },
              };
            }

            function _mmmBayesSlicePanel(panel, end) {
              return {
                ...panel,
                week: panel.week.slice(0, end),
                ch: Object.fromEntries(Object.entries(panel.ch || {}).map(([key, values]) => [key, values.slice(0, end)])),
                dummy: Object.fromEntries(Object.entries(panel.dummy || {}).map(([key, values]) => [key, values.slice(0, end)])),
                steps: Object.fromEntries(Object.entries(panel.steps || {}).map(([key, values]) => [key, values.slice(0, end)])),
                external: Object.fromEntries(Object.entries(panel.external || {}).map(([key, values]) => [key, values.slice(0, end)])),
                targets: Object.fromEntries(Object.entries(panel.targets || {}).map(([key, values]) => [key, values.slice(0, end)])),
                weekLabel: panel.weekLabel?.slice(0, end),
                dateLabel: panel.dateLabel?.slice(0, end),
                dates: panel.dates?.slice(0, end),
              };
            }

            function _mmmMedian(values) {
              const ordered = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
              if (!ordered.length) return Infinity;
              const middle = Math.floor(ordered.length / 2);
              return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
            }

            // 계절성 선택 단계에서는 매체별 flight가 연간 파형을 대신 설명하지
            // 않도록 Brand/Performance 의사결정 단위로만 집계한다. 최종 MMM은
            // 원래 채널 단위로 다시 적합하므로 채널별 기여도는 손실되지 않는다.
            function _mmmSeasonalitySelectionPanel(panel) {
              const channels = _mmmChans(panel).filter((channel) => panel.ch?.[channel.key]);
              const groups = new Map();
              channels.forEach((channel) => {
                const key = channel.kind === "brand" ? "__season_brand" : "__season_performance";
                if (!groups.has(key)) groups.set(key, { key, label: channel.kind === "brand" ? "Brand" : "Performance", kind: channel.kind, values: new Array(panel.week.length).fill(0) });
                const values = groups.get(key).values;
                panel.ch[channel.key].forEach((value, index) => { values[index] += Number.isFinite(value) ? value : 0; });
              });
              if (groups.size <= 1 || !panel.week?.length) return panel;
              return {
                ...panel,
                ch: Object.fromEntries([...groups.values()].map((group) => [group.key, group.values])),
                channels: [...groups.values()].map(({ key, label, kind }) => ({ key, label, kind })),
              };
            }

            function _mmmBayesSeasonalityCandidateFit(panel, cfg, targetName, periods, channelParams, options = {}) {
              const candidateCfg = { ...cfg, baselineKnots: [], seasonalityPeriods: periods.slice() };
              const built = _mmmBayesControlFeatures(panel, candidateCfg);
              const names = built.names.slice();
              const cols = built.X.length ? built.X[0].map((_, index) => built.X.map((row) => row[index])) : [];
              const channels = _mmmChans(panel).filter((channel) => panel.ch[channel.key] && channelParams[channel.key]);
              channels.forEach((channel) => {
                const params = channelParams[channel.key];
                names.push("media_" + channel.key);
                cols.push(mmmAdstock(panel.ch[channel.key], params.alpha).map((value) => mmmHill(value, params.ec, params.slope)));
              });
              const y = panel.targets[targetName];
              if (!names.length) {
                const mean = _mean(y);
                const resid = y.map((value) => value - mean);
                const sse = resid.reduce((sum, value) => sum + value ** 2, 0);
                return { names, posterior: { fitted: y.map(() => mean), resid }, sse, bic: y.length * Math.log(Math.max(sse / Math.max(1, y.length), 1e-12)) + Math.log(Math.max(2, y.length)) };
              }
              const fit = _mmmBayesFitColumns(names, cols, channels, y, {
                ...options,
                mediaPenalty: cfg.mediaPenalty,
                controlPenalty: cfg.controlPenalty,
              });
              if (!fit) return null;
              const sse = fit.posterior.resid.reduce((sum, value) => sum + value ** 2, 0);
              const bic = y.length * Math.log(Math.max(sse / Math.max(1, y.length), 1e-12))
                + (names.length + 1) * Math.log(Math.max(2, y.length));
              const seasonalNames = new Set(names.filter((name) => /^(sin|cos)_/.test(name)));
              const seasonal = y.map((_, rowIndex) => names.reduce((sum, name, columnIndex) => (
                seasonalNames.has(name) ? sum + (fit.absoluteBeta[columnIndex] || 0) * cols[columnIndex][rowIndex] : sum
              ), 0));
              return { ...fit, names, sse, bic, seasonal };
            }

            // 계절성은 장기 구조이고 Cost 반응은 단기 예측 변수다. 따라서 최근
            // 12주 오차로 계절성 존폐를 고르지 않는다. Brand/Performance로 집계한
            // 매체·이벤트·추세를 통제한 전체 이력에서 연간 파형의 BIC 개선과
            // 52주 간 파형 안정성을 먼저 확인한 뒤 annual-1~4의 복잡도를 비교한다.
            export function mmmBayesianSeasonalitySelection(panel, cfg, targetName, options = {}) {
              const n = panel.week?.length || 0;
              const specs = (cfg.seasonalityCandidates || []).filter((spec) => Array.isArray(spec.periods));
              const configuredMinHistory = cfg.seasonalityMinHistory || 104;
              // 96주는 두 번째 연간 주기의 대부분을 관측한 실무 최소치다. 기존
              // 104주 계약은 `seasonalityMinHistory: 104`를 명시한 호출에서
              // 그대로 유지된다.
              const minHistory = Math.max(96, configuredMinHistory);
              if (options.enableSeasonalitySelection === false || n < minHistory || !specs.length) {
                return { enabled: false, cfg, selected: null, candidates: [], reason: "insufficient-history-or-disabled" };
              }
              const selectionPanel = _mmmSeasonalitySelectionPanel(panel);
              const neutralCfg = { ...cfg, baselineKnots: [], seasonalityPeriods: [] };
              const neutralControls = _mmmBayesControlFeatures(selectionPanel, neutralCfg);
              const channelParams = _mmmBayesChannelParams(selectionPanel, neutralCfg, targetName, neutralControls);
              const evaluated = specs.map((spec) => {
                const fit = _mmmBayesSeasonalityCandidateFit(selectionPanel, cfg, targetName, spec.periods, channelParams, options);
                return fit ? { ...spec, bic: fit.bic, sse: fit.sse, residuals: fit.posterior.resid, seasonal: fit.seasonal || [] } : null;
              }).filter(Boolean);
              const none = evaluated.find((item) => item.periods.length === 0);
              const groupedAnnualCandidates = evaluated.filter((item) => item.periods.length > 0);
              if (!none || !groupedAnnualCandidates.length) return { enabled: false, cfg, selected: null, candidates: evaluated, reason: "required-candidate-fit-failed" };
              const groupedBest = groupedAnnualCandidates.reduce((winner, item) => item.bic < winner.bic ? item : winner, groupedAnnualCandidates[0]);
              // 검출은 집계 패널로 보수적으로 하고, 최종 후보 간 우열은 실제
              // 채널 단위 설계행렬의 BIC로 다시 확인한다. 두 단계가 달라야
              // 특정 채널 flight가 계절성을 독점하지 않으면서도 최종 분해의
              // 채널 구조를 반영할 수 있다.
              const shortlist = groupedAnnualCandidates.filter((item) => item.bic <= groupedBest.bic + (cfg.seasonalityComplexityTolerance ?? 2));
              const finalNeutralControls = _mmmBayesControlFeatures(panel, neutralCfg);
              const finalChannelParams = _mmmBayesChannelParams(panel, neutralCfg, targetName, finalNeutralControls);
              const finalBicById = new Map();
              shortlist.forEach((item) => {
                const fit = _mmmBayesSeasonalityCandidateFit(panel, cfg, targetName, item.periods, finalChannelParams, options);
                if (fit) finalBicById.set(item.id, fit.bic);
              });
              const annualCandidates = groupedAnnualCandidates.map((item) => ({
                ...item,
                finalBic: finalBicById.get(item.id) ?? null,
              }));
              const best = annualCandidates.reduce((winner, item) => (Number.isFinite(item.finalBic) ? item.finalBic : item.bic) < (Number.isFinite(winner.finalBic) ? winner.finalBic : winner.bic) ? item : winner, annualCandidates[0]);
              const lag = 52;
              const lagCorrelation = none.residuals.length > lag
                ? CANNIBAL_STATS.pearson(none.residuals.slice(lag), none.residuals.slice(0, -lag))
                : null;
              const seasonalLagCorrelation = best.seasonal.length > lag
                ? CANNIBAL_STATS.pearson(best.seasonal.slice(lag), best.seasonal.slice(0, -lag))
                : null;
              const seasonalRms = best.seasonal.length ? Math.sqrt(_mean(best.seasonal.map((value) => value ** 2))) : 0;
              const bicImprovement = none.bic - groupedBest.bic;
              const finalBicImprovement = Number.isFinite(best.finalBic) ? none.bic - best.finalBic : null;
              const relativeSseImprovement = none.sse > 1e-12 ? (none.sse - groupedBest.sse) / none.sse : 0;
              const evidence = {
                minHistory,
                observedWeeks: n,
                lagWeeks: lag,
                lagCorrelation,
                seasonalLagCorrelation,
                seasonalRms,
                bicImprovement,
                finalBicImprovement,
                relativeSseImprovement,
                // 계절성 선택은 분해용이다. 최근 holdout을 통과시키는 대신,
                // 집계 매체를 통제한 전체 이력에서 구조적 BIC 개선과 동일한
                // 연간 파형의 재현성을 요구한다. 미래 예측은 별도 rolling
                // 선택을 사용한다.
                detected: bicImprovement >= (cfg.seasonalityBicThreshold || 6)
                  && Number.isFinite(seasonalLagCorrelation)
                  && seasonalLagCorrelation >= 0.75
                  && seasonalRms >= Math.max(1, _mean(selectionPanel.targets[targetName]) * 0.005),
              };
              const eligible = evidence.detected
                ? annualCandidates
                : [none];
              const bestEligible = eligible.reduce((winner, item) => (Number.isFinite(item.finalBic) ? item.finalBic : item.bic) < (Number.isFinite(winner.finalBic) ? winner.finalBic : winner.bic) ? item : winner, eligible[0]);
              const selected = eligible
                .filter((item) => (Number.isFinite(item.finalBic) ? item.finalBic : item.bic) <= (Number.isFinite(bestEligible.finalBic) ? bestEligible.finalBic : bestEligible.bic) + (cfg.seasonalityComplexityTolerance ?? 2))
                .sort((a, b) => a.periods.length - b.periods.length || String(a.id).localeCompare(String(b.id)))[0];
              const publicCandidates = evaluated.map(({ residuals, seasonal, ...item }) => ({
                ...item,
                deltaBicVsNone: none.bic - item.bic,
                finalBic: finalBicById.get(item.id) ?? null,
                finalDeltaBicVsNone: finalBicById.has(item.id) ? none.bic - finalBicById.get(item.id) : null,
              }));
              return {
                enabled: true,
                cfg: { ...cfg, seasonalityPeriods: selected.periods.slice() },
                selected: {
                  ...publicCandidates.find((item) => item.id === selected.id),
                  bestBic: Number.isFinite(bestEligible.finalBic) ? bestEligible.finalBic : bestEligible.bic,
                  complexityTolerance: cfg.seasonalityComplexityTolerance ?? 2,
                  evidence,
                },
                candidates: publicCandidates,
                evidence,
                reason: evidence.detected
                  ? (selected.id === bestEligible.id ? "full-history-recurrence-business-structure-and-lowest-bic" : "full-history-recurrence-business-structure-smoother-bic-tie")
                  : "full-history-recurrence-business-structure-not-detected",
              };
            }

            // 매체 prior의 세기는 기여 크기를 맞추기 위한 손잡이가 아니라 예측 성능을
            // 위한 hyperparameter다. 마지막 한 구간만 보면 우연한 이벤트를 따라갈 수
            // 있으므로, 과거의 서로 다른 12주 구간을 모두 당시 정보만으로 예측한다.
            // 최저 오차와 사실상 동률이면 더 큰 penalty를 고르는 one-standard-error
            // 규칙으로 과도한 매체 귀속을 방지한다.
            export function mmmBayesianMediaPenaltySelection(panel, cfg, targetName, options = {}) {
              const n = panel.week?.length || 0;
              const horizon = Math.max(4, Math.min(cfg.mediaPenaltyHoldoutWeeks || 12, Math.floor(n / 3)));
              const minTrain = Math.max(24, cfg.mediaPenaltyMinTrain || 52);
              const candidates = [...new Set((cfg.mediaPenaltyCandidates || [cfg.mediaPenalty ?? 4])
                .filter((value) => Number.isFinite(value) && value >= 0))].sort((a, b) => a - b);
              if (options.enableMediaPenaltySelection === false || !candidates.length || n < minTrain + horizon) {
                return { enabled: false, cfg, selected: null, candidates: [], reason: "insufficient-history-or-disabled" };
              }
              const cuts = [];
              for (let cut = n - horizon; cut >= minTrain && cuts.length < (cfg.mediaPenaltyMaxFolds || 3); cut -= horizon) cuts.push(cut);
              if (!cuts.length) return { enabled: false, cfg, selected: null, candidates: [], reason: "no-valid-fold" };
              const evaluated = candidates.map((mediaPenalty) => {
                const foldWmapes = [];
                for (const cut of cuts) {
                  const train = _mmmBayesSlicePanel(panel, cut);
                  const run = mmmBayesianRun(train, { ...cfg, mediaPenalty }, targetName, false, {
                    ...options,
                    enableMediaPenaltySelection: false,
                    enableBaselineSelection: false,
                    skipTransformUncertainty: true,
                  });
                  const spend = Object.fromEntries(Object.entries(panel.ch || {}).map(([key, values]) => [key, values.slice(cut, cut + horizon)]));
                  const futureDummy = Object.fromEntries(Object.entries(panel.dummy || {}).map(([key, values]) => [key, values.slice(cut, cut + horizon)]));
                  const futureSteps = Object.fromEntries(Object.entries(panel.steps || {}).map(([key, values]) => [key, values.slice(cut, cut + horizon)]));
                  const futureExternal = Object.fromEntries(Object.entries(panel.external || {}).map(([key, values]) => [key, values.slice(cut, cut + horizon)]));
                  const forecast = run && mmmBayesianForecast(run, train, spend, horizon, { futureDummy, futureSteps, futureExternal });
                  const actual = panel.targets?.[targetName]?.slice(cut, cut + horizon) || [];
                  if (forecast?.predFut?.length !== actual.length || !actual.length) continue;
                  const absError = actual.reduce((sum, value, index) => sum + Math.abs(value - forecast.predFut[index]), 0);
                  const actualSum = actual.reduce((sum, value) => sum + Math.abs(value), 0);
                  if (actualSum > 1e-9) foldWmapes.push(absError / actualSum * 100);
                }
                const mean = foldWmapes.length ? foldWmapes.reduce((sum, value) => sum + value, 0) / foldWmapes.length : Infinity;
                const variance = foldWmapes.length > 1
                  ? foldWmapes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (foldWmapes.length - 1)
                  : 0;
                return { mediaPenalty, foldWmapes, wmape: mean, medianWmape: _mmmMedian(foldWmapes), standardError: Math.sqrt(variance / Math.max(1, foldWmapes.length)) };
              }).filter((item) => item.foldWmapes.length === cuts.length);
              if (!evaluated.length) return { enabled: false, cfg, selected: null, candidates: [], reason: "fold-fit-failed" };
              const best = evaluated.reduce((winner, item) => item.wmape < winner.wmape ? item : winner, evaluated[0]);
              const tolerance = Math.max(0.25, best.standardError || 0);
              const selected = evaluated
                .filter((item) => item.wmape <= best.wmape + tolerance)
                .sort((a, b) => b.mediaPenalty - a.mediaPenalty)[0];
              return {
                enabled: true,
                cfg: { ...cfg, mediaPenalty: selected.mediaPenalty },
                selected: { ...selected, bestWmape: best.wmape, tolerance, folds: cuts.length },
                candidates: evaluated,
                reason: selected.mediaPenalty === best.mediaPenalty ? "lowest-rolling-wmape" : "one-standard-error-more-conservative",
              };
            }

            function _mmmBayesJointTransformCheck(panel, cfg, targetName, controls, channelMeta, params, uncertainty, options = {}) {
              const eligible = channelMeta
                .filter((ch) => (uncertainty[ch.key]?.models || []).length > 1)
                .sort((a, b) => (uncertainty[a.key]?.topWeight || 1) - (uncertainty[b.key]?.topWeight || 1))
                .slice(0, 2);
              if (eligible.length < 2) return { enabled: false, reason: "fewer-than-two-uncertain-channels" };
              const modelSets = eligible.map((ch) => (uncertainty[ch.key].models || []).slice().sort((a, b) => b.weight - a.weight).slice(0, 2));
              const combinations = [];
              modelSets[0].forEach((first) => modelSets[1].forEach((second) => combinations.push([first, second])));
              const evaluated = combinations.map((choice) => {
                const choiceByKey = Object.fromEntries(eligible.map((ch, index) => [ch.key, choice[index]]));
                const names = controls.names.slice();
                const cols = controls.X.length ? controls.X[0].map((_, j) => controls.X.map((row) => row[j])) : [];
                channelMeta.forEach((ch) => {
                  const p = choiceByKey[ch.key] || params[ch.key];
                  names.push("media_" + ch.key);
                  cols.push(mmmAdstock(panel.ch[ch.key], p.alpha).map((value) => mmmHill(value, p.ec, p.slope)));
                });
                const fit = _mmmBayesFitColumns(names, cols, channelMeta, panel.targets[targetName], options);
                if (!fit) return { choice, bic: Infinity };
                const sse = fit.posterior.resid.reduce((sum, value) => sum + value ** 2, 0);
                return { choice, bic: panel.week.length * Math.log(Math.max(sse / Math.max(1, panel.week.length), 1e-12)) + (names.length + 1) * Math.log(Math.max(2, panel.week.length)) };
              }).sort((a, b) => a.bic - b.bic);
              return {
                enabled: true,
                channels: eligible.map((ch) => ch.key),
                candidateCount: combinations.length,
                evaluatedCount: evaluated.filter((item) => Number.isFinite(item.bic)).length,
                selectedBic: evaluated[0]?.bic ?? null,
                baselineBic: evaluated.find((item) => item.choice.every((model, index) => model === modelSets[index][0]))?.bic ?? null,
                selected: evaluated[0]?.choice?.map((model) => ({ alpha: model.alpha, ec: model.ec, slope: model.slope })) || [],
                appliedToCoefficients: false,
                note: "limited-joint-diagnostic",
              };
            }

            export function mmmBayesianRun(panel, cfg, targetName, withBacktest = true, options = {}) {
              const targetSeries = panel.targets?.[targetName];
              if (!targetSeries?.length || targetSeries.some((value) => !Number.isFinite(value))) return null;
              if (_mmmChans(panel).some((channel) => panel.ch[channel.key]?.some((value) => !Number.isFinite(value)))) return null;
              if (Object.values(panel.external || {}).some((series) => series.some((value) => !Number.isFinite(value)))) return null;
              // 장기 계절성을 먼저 전체 이력에서 확정한다. Baseline knot을 먼저
              // 고르면 저주파 굴절이 연간 파형을 흡수할 수 있으므로, knot은 확정된
              // 계절성을 유지한 상태에서만 비교한다. 최근 12주 rolling은 이후 매체
              // 규제 선택에만 사용한다.
              const seasonalitySelection = mmmBayesianSeasonalitySelection(panel, cfg, targetName, options);
              const baseline = _mmmBayesBaselineSelection(panel, seasonalitySelection.cfg, targetName, options);
              const penaltySelection = mmmBayesianMediaPenaltySelection(panel, baseline.cfg, targetName, options);
              const effectiveCfg = penaltySelection.cfg;
              const fitOptions = {
                ...options,
                mediaPenalty: effectiveCfg.mediaPenalty,
                controlPenalty: effectiveCfg.controlPenalty,
              };
              const controls = _mmmBayesControlFeatures(panel, effectiveCfg);
              const selectedParams = _mmmBayesChannelParams(panel, effectiveCfg, targetName, controls);
              // 참고시장 계수를 타깃과 같은 feature 단위로 추정할 때는 타깃이
              // 선택한 alpha/ec/slope를 명시적으로 고정한다. 각 참고시장이 자체
              // 변환을 고른 뒤 계수 숫자만 전이하면 서로 다른 Hill 단위를 같은
              // 효과처럼 취급하게 되므로 허용하지 않는다.
              const params = Object.fromEntries(Object.entries(selectedParams).map(([key, value]) => {
                const fixed = options.channelParams?.[key];
                return [key, fixed && Number.isFinite(fixed.alpha) && fixed.ec > 0 && fixed.slope > 0
                  ? { ...fixed, fixedFromTarget: true }
                  : value];
              }));
              const names = controls.names.slice();
              const cols = controls.X.length ? controls.X[0].map((_, j) => controls.X.map((r) => r[j])) : [];
              const channelMeta = _mmmChans(panel).filter((ch) => panel.ch[ch.key] && params[ch.key]);
              for (const ch of channelMeta) {
                const p = params[ch.key];
                names.push("media_" + ch.key);
                cols.push(mmmAdstock(panel.ch[ch.key], p.alpha).map((v) => mmmHill(v, p.ec, p.slope)));
              }
              const fitted = _mmmBayesFitColumns(names, cols, channelMeta, targetSeries, fitOptions);
              if (!fitted) return null;
              const { Xraw, colMean, colScale, X, posterior, absoluteBeta, absoluteIntercept } = fitted;
              // 추정은 표준화 공간에서 안정적으로 하되, 화면 기여는 원 단위 절대기여로
              // 되돌린다. 평균 중심화 X를 그대로 쓰면 양수 매체 효과도 저지출 주에
              // 음수처럼 보여 "광고가 성과를 깎았다"는 잘못된 해석을 만든다.
              // 반복 백테스트는 후보 prior를 여러 번 비교하므로, 효과 CI가 필요 없는
              // 선택 단계에서는 profile posterior 재적합을 생략한다. 최종 결과만 전체
              // 변환 불확실성을 평균내어 표시한다.
              const transformUncertainty = options.skipTransformUncertainty
                ? {}
                : _mmmBayesTransformUncertainty(panel, effectiveCfg, names, cols, channelMeta, { ...fitOptions, targetName, channelParams: params });
              const jointTransform = options.skipTransformUncertainty
                ? { enabled: false, reason: "transform-uncertainty-skipped" }
                : _mmmBayesJointTransformCheck(panel, effectiveCfg, targetName, controls, channelMeta, params, transformUncertainty, fitOptions);
              // 회사 MMM 대시보드처럼 채널별이 아니라 의사결정 단위로 묶는다.
              // MmmColumnMapper의 kind=brand는 Brand, 나머지 매체는 Performance.
              const mediaGroups = [];
              if (channelMeta.some((ch) => ch.kind !== "brand")) mediaGroups.push("Performance");
              if (channelMeta.some((ch) => ch.kind === "brand")) mediaGroups.push("Brand");
              // 구조 변화는 사용자가 `step`으로 명시 매핑한 컬럼만 해당한다.
              // baseline knot은 자연 추세의 굴절점이지 step이 아니므로 구조 변화로
              // 묶으면 안 된다.
              const stepNames = new Set(Object.keys(panel.steps || {}).filter((key) => names.includes(key)));
              const industryNames = new Set(Object.keys(panel.external || {}).map((key) => "industry_" + key).filter((key) => names.includes(key)));
              const groupNames = ["Trend", "Seasonality", "Holidays & Events", ...(stepNames.size ? ["Regime change"] : []), ...(industryNames.size ? ["Industry Trend"] : []), ...mediaGroups];
              const groupFor = (name) => {
                if (name === "trend" || name.startsWith("baseline_knot_")) return "Trend";
                if (/^(sin|cos)_/.test(name)) return "Seasonality";
                if (name === "lny" || name === "chuseok" || name.startsWith("d_")) return "Holidays & Events";
                if (industryNames.has(name)) return "Industry Trend";
                if (name.startsWith("media_")) {
                  const key = name.slice(6);
                  return (channelMeta.find((ch) => ch.key === key) || {}).kind === "brand"
                    ? "Brand"
                    : "Performance";
                }
                if (stepNames.has(name)) return "Regime change";
                // 알려지지 않은 제어변수는 step으로 임의 해석하지 않고 자연 기준선에
                // 남긴다. 따라서 매핑하지 않은 step이 화면에 생기지 않는다.
                return "Trend";
              };
              const predictiveSd = (row) => {
                const quad = row.reduce((sum, value, i) => sum + value * row.reduce((inner, other, j) => inner + posterior.XtXinv[i][j] * other, 0), 0);
                return Math.sqrt(Math.max(0, posterior.sigma2 * (1 + quad)));
              };
              const weeks = panel.week.map((week, t) => {
                const contrib = {};
                groupNames.forEach((g) => (contrib[g] = 0));
                // 장기 추세는 회귀절편과 한 덩어리인 자연수요 레벨이다. 절편을
                // 별도 상수로 두면 추세가 하락할 때 '음수 기여'처럼 읽히므로,
                // 절편을 Trend에 넣어 양수 레벨이 낮아지는 모습으로 표현한다.
                contrib.Trend = absoluteIntercept;
                names.forEach((name, j) => {
                  contrib[groupFor(name)] += absoluteBeta[j] * Xraw[t][j];
                });
                const predictionSd = predictiveSd(X[t]);
                return {
                  week,
                  actual: panel.targets[targetName][t],
                  baseline: 0,
                  fitted: +posterior.fitted[t].toFixed(2),
                  residual: +posterior.resid[t].toFixed(2),
                  contrib,
                  lo: +(posterior.fitted[t] - 1.645 * predictionSd).toFixed(2),
                  hi: +(posterior.fitted[t] + 1.645 * predictionSd).toFixed(2),
                };
              });
              const saturationByChannel = {};
              const channelCoverage = mmmChannelCoverage(panel, effectiveCfg);
              channelMeta.forEach((ch) => {
                const j = names.indexOf("media_" + ch.key);
                const raw = panel.ch[ch.key];
                // 최근 12개 달력 주 평균. 집행 주만 골라 평균내면 flight형 채널의
                // 현재 예산과 한계효용을 과대평가한다.
                const recentWindow = raw.slice(-12).filter(Number.isFinite);
                const recentMean = recentWindow.length ? _mean(recentWindow) : 0;
                const p = params[ch.key];
                const conditionalBeta = absoluteBeta[j];
                const conditionalSd = posterior.sd[j + 1] / colScale[j];
                const uncertainty = transformUncertainty[ch.key];
                const models = (uncertainty?.models || [{ alpha: p.alpha, ec: p.ec, slope: p.slope, beta: conditionalBeta, sd: conditionalSd, weight: 1 }]).map((model) => ({
                  ...model,
                  // 외부 prior·profile 평균도 0-spend 대비 절대기여 계약을 지킨다.
                  beta: Math.max(0, Number(model.beta) || 0),
                  historicalAdstockMax: mmmAdstock(raw, model.alpha).reduce((maximum, value) => Number.isFinite(value) ? Math.max(maximum, value) : maximum, 0),
                }));
                const beta = Math.max(0, uncertainty?.beta ?? conditionalBeta);
                const sd = uncertainty?.sd ?? conditionalSd;
                // 반응곡선의 x축은 "한 주만 집행"이 아니라 지속 가능한 주간 예산 수준이다.
                // 기하 adstock의 정상상태 spend/(1-alpha)를 써야 alpha가 곡선·marginal에 반영된다.
                const responseAt = (spend) => models.reduce((sum, model) => {
                  const steadyAdstock = Math.max(0, spend) / Math.max(0.05, 1 - Math.min(0.95, model.alpha));
                  return sum + model.weight * model.beta * mmmHill(steadyAdstock, model.ec, model.slope);
                }, 0);
                const marginalAt = (spend) => {
                  const h = Math.max(1, spend * 0.001);
                  const lower = Math.max(0, spend - h);
                  const upper = spend + h;
                  return (responseAt(upper) - responseAt(lower)) / Math.max(1e-9, upper - lower);
                };
                // 지속 주간 예산을 step만큼 올렸을 때의 KPI 증분 posterior. 각
                // profile 후보의 β 평균·SD를 같은 Hill 차분으로 변환한 뒤 혼합 CDF
                // 분위수를 풀어, 변환 후보가 엇갈릴 때 한계효과 구간도 넓어진다.
                const incrementalAt = (spend, step = 1000) => {
                  const safeSpend = Math.max(0, Number(spend) || 0);
                  const safeStep = Math.max(0, Number(step) || 0);
                  const profile = models.map((model) => {
                    const denominator = Math.max(0.05, 1 - Math.min(0.95, model.alpha));
                    const before = mmmHill(safeSpend / denominator, model.ec, model.slope);
                    const after = mmmHill((safeSpend + safeStep) / denominator, model.ec, model.slope);
                    const factor = after - before;
                    return {
                      beta: model.beta * factor,
                      sd: Math.abs(factor) * Math.max(0, model.sd || 0),
                      weight: model.weight,
                    };
                  });
                  const mean = profile.reduce((sum, item) => sum + item.weight * item.beta, 0);
                  const positiveProbability = Math.min(1, Math.max(0, profile.reduce(
                    (sum, item) => sum + item.weight * (item.sd > 0 ? mmmNormCdf(item.beta / item.sd) : item.beta > 0 ? 1 : 0),
                    0,
                  )));
                  return {
                    mean,
                    ci: [_mmmNormalMixtureQuantile(profile, 0.05), _mmmNormalMixtureQuantile(profile, 0.95)],
                    positiveProbability,
                    step: safeStep,
                  };
                };
                // 반응곡선은 지속 주간 spend의 정상상태 adstock을 사용하므로 raw
                // 주간 spend max만으로 외삽을 판정하면 flight형 채널을 잘못 통과시킨다.
                // BIC weight 상위 후보를 누적 95%까지 포함하고, 각 후보의 과거 adstock
                // 최대를 지속 주간 spend ceiling으로 역변환한 값 중 최솟값을 쓴다.
                const rangeModels = [];
                let rangeModelWeight = 0;
                [...models].sort((a, b) => b.weight - a.weight).forEach((model) => {
                  if (rangeModelWeight >= 0.95 && rangeModels.length) return;
                  rangeModels.push(model);
                  rangeModelWeight += model.weight;
                });
                const observedSustainableSpendMax = rangeModels.length
                  ? Math.min(...rangeModels.map((model) => model.historicalAdstockMax * Math.max(0.05, 1 - Math.min(0.95, model.alpha))))
                  : 0;
                const coverage = channelCoverage[ch.key] || {};
                saturationByChannel[ch.key] = {
                  key: ch.key,
                  label: ch.label,
                  ln_coef: beta,
                  ci: uncertainty?.ci || [beta - 1.645 * sd, beta + 1.645 * sd],
                  posteriorPositive: uncertainty?.posteriorPositive ?? (sd > 0 ? mmmNormCdf(beta / sd) : beta > 0 ? 1 : 0),
                  recentMean,
                  params: p,
                  transformUncertainty: uncertainty ? {
                    candidateCount: uncertainty.candidateCount,
                    totalCandidateCount: uncertainty.totalCandidateCount,
                    candidateSearchCapped: uncertainty.candidateSearchCapped,
                    priorLockedTransform: uncertainty.priorLockedTransform || false,
                    effectiveCandidateCount: uncertainty.effectiveCandidateCount,
                    topWeight: uncertainty.topWeight,
                  } : null,
                  responseAt,
                  marginalAt,
                  incrementalAt,
                  isIncrementInObservedRange: (spend, step = 0) => {
                    const upper = Math.max(0, Number(spend) || 0) + Math.max(0, Number(step) || 0);
                    return Number.isFinite(observedSustainableSpendMax)
                      && upper <= observedSustainableSpendMax + Math.max(1e-8, Math.abs(observedSustainableSpendMax) * 1e-9);
                  },
                  observedSustainableSpendMax,
                  observedRangeProfileWeight: Math.min(1, rangeModelWeight),
                  currentMarginal: marginalAt(recentMean) * 1000,
                  coverage,
                };
              });
              const variances = groupNames.map((g) => _mean(weeks.map((w) => (w.contrib[g] || 0) ** 2)));
              const totalVariance = variances.reduce((s, v) => s + v, 0) || 1;
              const rows = groupNames.map((driver, i) => ({ driver, r2_share: variances[i] / totalVariance, pct: (variances[i] / totalVariance) * 100 }));
              const vifs = CREATIVE_MATH.vif(X);
              const vifByName = names.map((name, j) => ({
                var: name,
                vif: Number.isFinite(vifs[j + 1]) ? +vifs[j + 1].toFixed(3) : null,
              })).sort((a, b) => (b.vif || 0) - (a.vif || 0));
              const collinearPairs = [];
              for (let i = 0; i < names.length; i++) {
                for (let j = i + 1; j < names.length; j++) {
                  if (!names[i].startsWith("media_") && !names[j].startsWith("media_")) continue;
                  const corr = CANNIBAL_STATS.pearson(cols[i], cols[j]);
                  if (Math.abs(corr) >= 0.85) collinearPairs.push({ a: names[i], b: names[j], corr: +corr.toFixed(3) });
                }
              }
              collinearPairs.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
              const parameterCount = names.length + 1;
              const weeksPerParameter = panel.week.length / Math.max(1, parameterCount);
              const maxMediaVif = Math.max(0, ...vifByName.filter((item) => item.var.startsWith("media_")).map((item) => item.vif || 0));
              const maxMediaCorrelation = Math.max(0, ...collinearPairs.map((pair) => Math.abs(pair.corr)));
              const identification = {
                observations: panel.week.length,
                parameterCount,
                weeksPerParameter,
                maxMediaVif,
                maxMediaCorrelation,
                highCollinearity: maxMediaVif >= 10 || maxMediaCorrelation >= 0.9,
                lowInformation: weeksPerParameter < 8 || panel.week.length < 52,
                priorScaleConverged: posterior.calibratedPriorCount === 0 || posterior.priorScaleConverged,
              };
              identification.budgetEligible = !identification.highCollinearity
                && !identification.lowInformation
                && identification.priorScaleConverged;
              Object.values(saturationByChannel).forEach((effect) => {
                effect.budgetEligible = identification.budgetEligible
                  && effect.posteriorPositive >= 0.8
                  && !effect.coverage?.sparse
                  && !effect.coverage?.constantSpend
                  && !effect.coverage?.trailingZero;
                effect.budgetGateReasons = [
                  ...(identification.highCollinearity ? ["high-collinearity"] : []),
                  ...(identification.lowInformation ? ["low-information"] : []),
                  ...(!identification.priorScaleConverged ? ["prior-scale-nonconvergence"] : []),
                  ...(effect.posteriorPositive < 0.8 ? ["low-positive-probability"] : []),
                  ...(effect.coverage?.sparse ? ["sparse-active-weeks"] : []),
                  ...(effect.coverage?.constantSpend ? ["constant-spend"] : []),
                  ...(effect.coverage?.trailingZero ? ["recently-inactive"] : []),
                ];
              });
              let backtest = null;
              let intervalCalibration = null;
              // 마지막 20%(최소 8주)는 학습에서 빼고, 당시 실제 지출을 넣어 순방향 예측한다.
              // 하이퍼파라미터 선택까지 train 안에서만 하므로 in-sample R²와 분리된 현실 점검이다.
              if (withBacktest && panel.week.length >= 48) {
                const cut = Math.floor(panel.week.length * 0.8);
                const train = _mmmBayesSlicePanel(panel, cut);
                // 전체기간에서 선택한 규제를 holdout 학습에 재사용하지 않는다.
                // 당시 train 구간에서 같은 rolling 선택을 다시 수행해 누수를 막는다.
                const held = mmmBayesianRun(train, cfg, targetName, false, { ...options, skipTransformUncertainty: true });
                const h = panel.week.length - cut;
                const spend = Object.fromEntries(Object.entries(panel.ch).map(([k, v]) => [k, v.slice(cut)]));
                const fc = held && mmmBayesianForecast(held, train, spend, h, {
                  futureDummy: Object.fromEntries(Object.entries(panel.dummy || {}).map(([key, values]) => [key, values.slice(cut)])),
                  futureSteps: Object.fromEntries(Object.entries(panel.steps || {}).map(([key, values]) => [key, values.slice(cut)])),
                  futureExternal: Object.fromEntries(Object.entries(panel.external || {}).map(([key, values]) => [key, values.slice(cut)])),
                });
                const actualHold = panel.targets[targetName].slice(cut);
                if (fc?.predFut?.length === actualHold.length) {
                  const err = actualHold.map((v, i) => v - fc.predFut[i]);
                  const absErr = err.map(Math.abs);
                  intervalCalibration = mmmBuildIntervalCalibration(actualHold, fc.predFut);
                  backtest = {
                    n: h,
                    rmse: Math.sqrt(_mean(err.map((v) => v * v))),
                    mape: _mean(err.map((v, i) => Math.abs(actualHold[i]) > 1e-9 ? Math.abs(v / actualHold[i]) * 100 : 0)),
                    wmape: absErr.reduce((sum, value) => sum + value, 0) / Math.max(1e-9, actualHold.reduce((sum, value) => sum + Math.abs(value), 0)) * 100,
                    calibratedPriorCount: held.posterior.calibratedPriorCount || 0,
                    intervalCalibration,
                  };
                }
              }
              return {
                engine: "bayesian",
                methodLabel: "Browser empirical-Bayes MMM (conditional Gaussian approximation)",
                params,
                names,
                featureMeans: colMean,
                featureScales: colScale,
                rawFeatureHistory: Xraw,
                externalTransforms: controls.externalTransforms || {},
                seasonalityPeriods: effectiveCfg.seasonalityPeriods,
                standardizedX: X,
                channelMeta,
                absoluteBeta,
                absoluteIntercept,
                posterior,
                weeks,
                groupNames,
                saturationByChannel,
                shapley: { rows, total: 1 }, // backwards-compatible consumer shape; this is contribution variance, not Shapley R².
                best_lambda: null,
                cv_rmse: {},
                vif: vifByName,
                collinear_pairs: collinearPairs,
                identification,
                elasticities: [],
                backtest,
                intervalCalibration,
                baselineSelection: baseline.selection,
                seasonalitySelection,
                mediaPenaltySelection: penaltySelection,
                effectiveCfg,
                jointTransform,
                appliedMediaPriors: options.mediaPriors || {},
              };
            }

            function _mmmSliceWindowPanel(panel, start, end) {
              const sliceSeries = (series = {}) => Object.fromEntries(
                Object.entries(series).map(([key, values]) => [key, values.slice(start, end)]),
              );
              return {
                ...panel,
                week: panel.week.slice(start, end),
                weekLabel: panel.weekLabel?.slice(start, end),
                dateLabel: panel.dateLabel?.slice(start, end),
                dates: panel.dates?.slice(start, end),
                ch: sliceSeries(panel.ch),
                dummy: sliceSeries(panel.dummy),
                steps: sliceSeries(panel.steps),
                external: sliceSeries(panel.external),
                targets: sliceSeries(panel.targets),
              };
            }

            // Cost 회귀의 학습 창과 계절성 정보 창을 분리한다. 계절성은 당시까지
            // 누적된 전체 이력에서만 추출하고, 최근 Cost 회귀는 이 seasonal offset을
            // 뺀 목표를 적합한다. 이 방식은 holdout의 실제값을 계절성에 쓰지 않는다.
            // 추세를 원자료에 바로 맞추면 delist/reopen 같은 구조변화의 수직 이동이
            // 기울기에 섞여 미래 하락·상승으로 잘못 연장된다. 이벤트·step을 같은
            // 회귀의 통제변수로 넣고, 그 효과를 조건부로 제거한 추세/계절성만 반환한다.
            function _mmmForecastEventControls(panel, length) {
              const controls = [];
              for (const [kind, series] of [["event", panel?.dummy || {}], ["step", panel?.steps || {}]]) {
                for (const [key, source] of Object.entries(series)) {
                  if (!Array.isArray(source) || source.length !== length || !source.every(Number.isFinite)) continue;
                  const min = Math.min(...source), max = Math.max(...source);
                  if (min === max) continue;
                  controls.push({ key: `${kind}:${key}`, values: source.slice() });
                }
              }
              return controls;
            }

            export function mmmForecastGlobalBaseline(panel, targetName, periods = []) {
              const y = panel?.targets?.[targetName];
              const t = panel?.week;
              if (!y?.length || !t?.length || y.length !== t.length || y.some((value) => !Number.isFinite(value))) return null;
              const meanT = _mean(t), sdT = _pstd(t) || 1;
              const controls = _mmmForecastEventControls(panel, y.length);
              const names = [
                "trend",
                ...periods.flatMap((_, index) => [`sin:${index}`, `cos:${index}`]),
                ...controls.map((control) => control.key),
              ];
              const rawX = t.map((week, rowIndex) => [
                (week - meanT) / sdT,
                ...periods.flatMap((period) => [Math.sin(2 * Math.PI * week / period), Math.cos(2 * Math.PI * week / period)]),
                ...controls.map((control) => control.values[rowIndex]),
              ]);
              const keep = _nonRedundantCols(rawX, names);
              const keptNames = keep.map((index) => names[index]);
              const X = rawX.map((row) => [1, ...keep.map((index) => row[index])]);
              const fit = mmmOls(X, y);
              if (!fit?.beta?.every(Number.isFinite)) return null;
              const betaFor = (name) => {
                const index = keptNames.indexOf(name);
                return index >= 0 ? fit.beta[index + 1] : 0;
              };
              const offsetAt = (week) => periods.reduce((sum, period, index) => {
                return sum + betaFor(`sin:${index}`) * Math.sin(2 * Math.PI * week / period) + betaFor(`cos:${index}`) * Math.cos(2 * Math.PI * week / period);
              }, 0);
              const trendOffsetAt = (week) => betaFor("trend") * ((week - meanT) / sdT);
              return {
                periods: periods.slice(), beta: fit.beta.slice(), offsetAt, trendOffsetAt,
                eventControls: keptNames.filter((name) => name.startsWith("event:") || name.startsWith("step:")),
              };
            }

            export function mmmForecastGlobalSeasonality(panel, targetName, periods = []) {
              if (!periods.length) return null;
              return mmmForecastGlobalBaseline(panel, targetName, periods);
            }

            // 구조변화가 섞인 최근 추세를 미래에 직선으로 연장하면 iOS delist/reopen
            // 같은 일회성 충격이 12주 내내 증폭된다. 마지막 관측 수준에 고정한 뒤
            // 변화분만 감쇠해 이어 간다. 기본값은 mmmBayesianForecast의 추세 감쇠와 같다.
            export function mmmForecastDampedTrendOffset(trendModel, lastWeek, week, damping = 0.25) {
              if (!trendModel?.trendOffsetAt || !Number.isFinite(lastWeek)) return 0;
              const anchor = trendModel.trendOffsetAt(lastWeek);
              const target = trendModel.trendOffsetAt(week);
              const weight = Number.isFinite(damping) ? Math.max(0, Math.min(1, damping)) : 0.25;
              return anchor + (target - anchor) * weight;
            }

            export function mmmForecastSeasonalAdjustedPanel(panel, targetName, seasonalModel) {
              if (!seasonalModel?.offsetAt) return panel;
              const target = panel?.targets?.[targetName];
              if (!target?.length) return panel;
              return {
                ...panel,
                targets: {
                  ...panel.targets,
                  [targetName]: target.map((value, index) => value - seasonalModel.offsetAt(panel.week[index])),
                },
              };
            }

            export function mmmForecastRestoreSeasonality(forecast, panel, seasonalModel) {
              if (!forecast || !seasonalModel?.offsetAt) return forecast;
              const histOffset = (panel?.week || []).map((week) => seasonalModel.offsetAt(week));
              const futureOffset = (forecast.futWeek || []).map((week, index) =>
                seasonalModel.futureOffsetAt ? seasonalModel.futureOffsetAt(week, index) : seasonalModel.offsetAt(week),
              );
              const plus = (values, offsets) => values?.map((value, index) => value + (offsets[index] || 0));
              // Cost=0 기준선은 수요의 하한이다. 계절성·추세를 다시 더하는 과정에서
              // 음수가 되면 "음의 organic"을 만들지 않고 0으로만 제한한다. 예측값 자체는
              // 건드리지 않아 이벤트/구조변화(P0)의 효과를 이 함수에서 재해석하지 않는다.
              const restoredBaseline = plus(forecast.baselineFut, futureOffset);
              const baselineFloorApplied = restoredBaseline?.filter((value) => Number.isFinite(value) && value < 0).length || 0;
              return {
                ...forecast,
                actual: plus(forecast.actual, histOffset),
                fittedHist: plus(forecast.fittedHist, histOffset),
                predFut: plus(forecast.predFut, futureOffset),
                lo: plus(forecast.lo, futureOffset),
                hi: plus(forecast.hi, futureOffset),
                baselineFut: restoredBaseline?.map((value) => Number.isFinite(value) ? Math.max(0, value) : value),
                baselineFloorApplied: (forecast.baselineFloorApplied || 0) + baselineFloorApplied,
              };
            }

            // 최근 운영 체계가 과거와 다를 때 전체 기간을 모두 쓰면 Cost 반응이
            // 희석된다. 후보 window와 계절성 복잡도를 시간순 12주 holdout으로
            // 비교해, 가장 낮은 pooled wMAPE 조합만 최종 적합에 넘긴다.
            // 이 선택용 적합은 브라우저 응답성을 위해 작은 변환 grid를 쓴다.
            // 최종 선택 조합은 원래의 전체 transform grid로 다시 적합한다.
            export function mmmForecastRollingSelection(panel, cfg, targetName, options = {}) {
              const n = panel?.week?.length || 0;
              const horizon = Math.max(4, Math.min(26, options.horizon || 12));
              // 75주 원자료처럼 가능한 경우 12주 독립 holdout 3회를 기본으로 쓴다.
              // 짧은 이력은 2회로만 후보를 만들되, Cost 변경 시나리오의 의사결정
              // 자격은 주지 않는다. 단순 최근 1회 적합이 과대평가되는 것을 막는다.
              const feasibleFolds = Math.floor((n - 16) / horizon);
              const decisionMinFolds = Math.max(3, options.decisionMinFolds || 3);
              const minFolds = Math.max(2, Math.min(
                options.minFolds == null ? decisionMinFolds : options.minFolds,
                feasibleFolds,
              ));
              const maxFolds = Math.max(minFolds, Math.min(options.maxFolds || decisionMinFolds, feasibleFolds));
              const maxWindow = n - horizon * minFolds;
              const defaultWindows = [...new Set([24, 30, 36, 42, 48, 54, 60, 72, 84, 104, 130, 156, maxWindow])];
              const candidateWindows = (options.candidateWindows || defaultWindows)
                .filter((window) => Number.isInteger(window) && window >= 16 && window + horizon * minFolds <= n);
              if (!panel?.targets?.[targetName]?.length || !_mmmChans(panel).length || !candidateWindows.length) {
                return { enabled: false, reason: "insufficient-history", horizon, candidates: [] };
              }
              const specs = [{ id: "cost-trend", seasonalityPeriods: [], seasonalityScope: "none", minWindow: 16, minHistory: 0 }];
              if (n >= 52) {
                specs.push({ id: "cost-trend-quarter", seasonalityPeriods: [13.04], seasonalityScope: "recent", minWindow: 52, minHistory: 0 });
                specs.push({ id: "cost-trend-global-quarter", seasonalityPeriods: [13.04], seasonalityScope: "global", minWindow: 16, minHistory: 39 });
              }
              // 연간 Fourier는 최소 2회 반복된 주기가 있어야 holdout으로 검증할
              // 여지가 있다. 75주처럼 1회 남짓인 입력에는 후보로도 넣지 않는다.
              if (n >= (options.annualMinWeeks || 104)) {
                specs.push({ id: "cost-trend-year-quarter", seasonalityPeriods: [52.18, 13.04], seasonalityScope: "recent", minWindow: options.annualMinWeeks || 104, minHistory: 0 });
                specs.push({ id: "cost-trend-global-year-quarter", seasonalityPeriods: [52.18, 13.04], seasonalityScope: "global", minWindow: 16, minHistory: options.annualMinWeeks || 104 });
              }
              const selectionCfg = {
                ...cfg,
                adstockGrid: options.adstockGrid || [0, 0.4, 0.7],
                bayesHalfSaturationQuantiles: options.bayesHalfSaturationQuantiles || [0.6],
                bayesHillSlopeGrid: options.bayesHillSlopeGrid || [1],
                baselineKnots: [],
              };
              const candidates = [];
              for (const spec of specs) {
                const trendOptions = [{ trendScope: "recent", trendWindow: null }, ...[24, 36, "all"].map((trendWindow) => ({ trendScope: "global", trendWindow }))];
                for (const trendOption of trendOptions) for (const window of candidateWindows) {
                  if (window < spec.minWindow) continue;
                  const outcomes = [];
                  let trendEventControls = 0;
                  for (let fold = maxFolds; fold >= 1; fold--) {
                    const holdoutEnd = n - (fold - 1) * horizon;
                    const holdoutStart = holdoutEnd - horizon;
                    const trainStart = holdoutStart - window;
                    if (trainStart < 0 || holdoutStart < spec.minHistory) continue;
                    const rawTrain = _mmmSliceWindowPanel(panel, trainStart, holdoutStart);
                    const held = _mmmSliceWindowPanel(panel, holdoutStart, holdoutEnd);
                    const seasonalModel = spec.seasonalityScope === "global"
                      ? mmmForecastGlobalSeasonality(_mmmSliceWindowPanel(panel, 0, holdoutStart), targetName, spec.seasonalityPeriods)
                      : null;
                    if (spec.seasonalityScope === "global" && !seasonalModel) continue;
                    const trendStart = trendOption.trendWindow === "all" ? 0 : Math.max(0, holdoutStart - (trendOption.trendWindow || 0));
                    const trendModel = trendOption.trendScope === "global"
                      ? mmmForecastGlobalBaseline(_mmmSliceWindowPanel(panel, trendStart, holdoutStart), targetName, [])
                      : null;
                    if (trendOption.trendScope === "global" && !trendModel) continue;
                    trendEventControls = Math.max(trendEventControls, trendModel?.eventControls?.length || seasonalModel?.eventControls?.length || 0);
                    const trainLastWeek = rawTrain.week.at(-1);
                    const offsetAt = (week) => (seasonalModel?.offsetAt(week) || 0) + (trendModel?.trendOffsetAt(week) || 0);
                    const futureOffsetAt = (week) => (seasonalModel?.offsetAt(week) || 0) + mmmForecastDampedTrendOffset(trendModel, trainLastWeek, week);
                    const train = (seasonalModel || trendModel)
                      ? { ...rawTrain, targets: { ...rawTrain.targets, [targetName]: rawTrain.targets[targetName].map((value, index) => value - offsetAt(rawTrain.week[index])) } }
                      : rawTrain;
                    const fitCfg = {
                      ...selectionCfg,
                      seasonalityPeriods: spec.seasonalityScope === "recent" ? spec.seasonalityPeriods : [],
                      includeTrend: trendOption.trendScope !== "global",
                    };
                    const fit = mmmBayesianRun(train, fitCfg, targetName, false, {
                      skipTransformUncertainty: true,
                      enableBaselineSelection: false,
                    });
                    const forecast = fit && mmmBayesianForecast(fit, train, held.ch, horizon, {
                      futureDummy: held.dummy,
                      futureSteps: held.steps,
                      clampScenario: false,
                      trendDamping: 0,
                    });
                    const actual = held.targets[targetName];
                    const predicted = (seasonalModel || trendModel)
                      ? forecast?.predFut?.map((value, index) => value + futureOffsetAt(held.week[index]))
                      : forecast?.predFut;
                    if (!predicted?.length || predicted.length !== actual?.length || !predicted.every(Number.isFinite)) continue;
                    const recent = train.targets[targetName].slice(-Math.min(8, train.targets[targetName].length));
                    const persistence = recent.reduce((sum, value) => sum + value, 0) / Math.max(1, recent.length);
                    outcomes.push({ actual, predicted, persistence: Array(horizon).fill(persistence) });
                  }
                  if (outcomes.length < minFolds) continue;
                  const actualAbs = outcomes.flatMap((item) => item.actual.map((value) => Math.abs(value)));
                  const modelAbsError = outcomes.flatMap((item) => item.actual.map((value, index) => Math.abs(value - item.predicted[index])));
                  const persistenceAbsError = outcomes.flatMap((item) => item.actual.map((value, index) => Math.abs(value - item.persistence[index])));
                  const denominator = actualAbs.reduce((sum, value) => sum + value, 0);
                  if (!(denominator > 0)) continue;
                  const foldWmape = (item) => item.actual.reduce((sum, value, index) => sum + Math.abs(value - item.predicted[index]), 0)
                    / Math.max(1e-9, item.actual.reduce((sum, value) => sum + Math.abs(value), 0)) * 100;
                  const persistenceFoldWmape = (item) => item.actual.reduce((sum, value, index) => sum + Math.abs(value - item.persistence[index]), 0)
                    / Math.max(1e-9, item.actual.reduce((sum, value) => sum + Math.abs(value), 0)) * 100;
                  const modelFold = outcomes.map(foldWmape);
                  const baselineFold = outcomes.map(persistenceFoldWmape);
                  candidates.push({
                    window,
                    spec: spec.id,
                    seasonalityPeriods: spec.seasonalityPeriods,
                    seasonalityScope: spec.seasonalityScope,
                    trendScope: trendOption.trendScope,
                    trendWindow: trendOption.trendWindow,
                    trendEventControls,
                    folds: outcomes.length,
                    wmape: modelAbsError.reduce((sum, value) => sum + value, 0) / denominator * 100,
                    persistenceWmape: persistenceAbsError.reduce((sum, value) => sum + value, 0) / denominator * 100,
                    foldWins: modelFold.filter((value, index) => value < baselineFold[index]).length,
                    latestWmape: modelFold.at(-1),
                    latestPersistenceWmape: baselineFold.at(-1),
                  });
                }
              }
              candidates.sort((a, b) => a.wmape - b.wmape || b.foldWins - a.foldWins || a.window - b.window);
              const selected = candidates[0] || null;
              const decisionReasons = [];
              if (selected) {
                if (selected.folds < decisionMinFolds) decisionReasons.push("fewer-than-three-holdouts");
                if (selected.wmape > selected.persistenceWmape) decisionReasons.push("does-not-beat-persistence");
                if (selected.foldWins < Math.ceil(selected.folds / 2)) decisionReasons.push("wins-too-few-holdouts");
              }
              return {
                enabled: !!selected,
                reason: selected ? null : "no-valid-time-ordered-fit",
                horizon,
                feasibleFolds: Math.max(0, feasibleFolds),
                decisionMinFolds,
                candidates,
                selected,
                decisionReasons,
                decisionEligible: !!selected && decisionReasons.length === 0,
              };
            }

            // 전체 MMM 기여 분석의 적격성과 분리된, "예측 회귀에서 Cost만 바꿔도 되는가"
            // 판정이다. 기본 예측은 계속 제공하되, 독립 holdout 또는 최근 창 내 채널
            // 식별이 부족하면 단일 채널 OFF/증액 입력만 잠근다.
            export function mmmForecastScenarioEligibility(models) {
              const items = (Array.isArray(models) ? models : [models]).filter(Boolean);
              if (!items.length) return { eligible: false, reasons: ["missing-model"] };
              const reasons = [];
              for (const model of items) {
                const selection = model.selection || model.rollingSelection;
                if (!selection?.decisionEligible) {
                  (selection?.decisionReasons?.length ? selection.decisionReasons : ["forecast-validation"]).forEach((reason) => reasons.push(reason));
                }
                const identification = model.run?.identification;
                if (identification?.highCollinearity) reasons.push("high-collinearity");
                if (identification?.lowInformation) reasons.push("low-information");
                if (identification?.budgetEligible === false && !identification?.highCollinearity && !identification?.lowInformation) reasons.push("scenario-identification");
              }
              return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] };
            }

            export function mmmBayesianWeeklyDecomp(run) {
              if (!run || run.engine !== "bayesian") return null;
              const actual = run.weeks.map((w) => w.actual);
              const resid = run.weeks.map((w) => w.residual);
              const meanActual = _mean(actual);
              const mape = _mean(
                run.weeks.map((w) =>
                  Math.abs(w.actual) > 1e-9 ? Math.abs(w.residual / w.actual) * 100 : 0,
                ),
              );
              const driverStats = run.groupNames.map((name) => {
                const values = run.weeks.map((w) => w.contrib[name] || 0);
                return {
                  name,
                  avg: _mean(values),
                  swing: Math.sqrt(_mean(values.map((v) => v * v))),
                  media: !MMM_NONMEDIA_GROUPS.includes(name),
                };
              });
              return {
                model: "bayesian",
                level: true,
                lambda: null,
                // UI의 '전체 기간 평균'은 회귀절편이 아니라 실제 성과 평균.
                baseline: +meanActual.toFixed(1),
                weeks: run.weeks,
                groupNames: run.groupNames,
                meanContrib: Object.fromEntries(
                  run.groupNames.map((g) => [g, _mean(run.weeks.map((w) => w.contrib[g] || 0))]),
                ),
                rmse: +Math.sqrt(_mean(resid.map((e) => e * e))).toFixed(1),
                mape: +mape.toFixed(1),
                driverStats,
                spikes: [],
                credibleLevel: 0.9,
                r2: +run.posterior.r2.toFixed(4),
              };
            }

            // Meridian의 post-modeling health checks 중 MCMC 전용 R-hat/trace를 제외하고,
            // 현재 empirical-Bayes 조건부 Gaussian 근사에서 계산 가능한 항목만 제공한다.
            export function mmmBayesianHealth(run) {
              if (!run || run.engine !== "bayesian" || !run.weeks?.length) return null;
              const actual = run.weeks.map((week) => week.actual);
              const fitted = run.weeks.map((week) => week.fitted);
              const residual = run.weeks.map((week) => week.residual);
              const absErr = residual.map(Math.abs);
              const wmape = absErr.reduce((sum, value) => sum + value, 0) / Math.max(1e-9, actual.reduce((sum, value) => sum + Math.abs(value), 0)) * 100;
              const coverage90 = run.weeks.filter((week) => week.actual >= week.lo && week.actual <= week.hi).length / run.weeks.length;
              const residualAcf1 = residual.length > 2
                ? CANNIBAL_STATS.pearson(residual.slice(1), residual.slice(0, -1))
                : 0;
              const naturalGroups = run.groupNames.filter((name) => MMM_NONMEDIA_GROUPS.includes(name));
              const naturalDemand = run.weeks.map((week) => week.baseline + naturalGroups.reduce((sum, name) => sum + (week.contrib[name] || 0), 0));
              const negativeBaselineShare = naturalDemand.filter((value) => value < 0).length / naturalDemand.length;
              const priorShifts = Object.entries(run.appliedMediaPriors || {}).map(([key, prior]) => {
                const posterior = run.saturationByChannel?.[key];
                const priorSd = prior?.precision > 0 ? 1 / Math.sqrt(prior.precision) : null;
                const shiftZ = posterior && priorSd > 0 ? (posterior.ln_coef - prior.mean) / priorSd : null;
                return {
                  key,
                  label: posterior?.label || key,
                  priorMean: prior?.mean,
                  priorSd,
                  posteriorMean: posterior?.ln_coef,
                  shiftZ,
                };
              });
              const flags = [];
              if (Math.abs(residualAcf1) >= 0.3) flags.push({ key: "residualAcf", severity: "warn" });
              if (coverage90 < 0.75 || coverage90 > 0.98) flags.push({ key: "coverage", severity: "warn" });
              if (negativeBaselineShare > 0) flags.push({ key: "negativeBaseline", severity: negativeBaselineShare > 0.05 ? "fail" : "warn" });
              if (priorShifts.some((item) => Math.abs(item.shiftZ) > 2)) flags.push({ key: "priorShift", severity: "warn" });
              if (run.posterior.calibratedPriorCount > 0 && !run.posterior.priorScaleConverged) flags.push({ key: "priorScale", severity: "warn" });
              if (run.identification?.highCollinearity) flags.push({ key: "identification", severity: "fail" });
              else if (run.identification?.lowInformation) flags.push({ key: "information", severity: "warn" });
              return {
                r2: run.posterior.r2,
                wmape,
                coverage90,
                residualAcf1,
                negativeBaselineShare,
                priorShifts,
                flags,
                identification: run.identification || null,
                fittedMean: _mean(fitted),
                oos: run.backtest || null,
                intervalCalibration: run.intervalCalibration || null,
                intervalScope: run.intervalCalibration?.enabled
                  ? "Conditional Gaussian interval widened by time-ordered holdout residual calibration"
                  : "Conditional Gaussian empirical-Bayes predictive reference interval, conditional on the representative transform",
                samplingDiagnostic: null,
              };
            }

            export function mmmBayesianForecast(run, panel, futureSpend, horizon, options = {}) {
              if (!run || run.engine !== "bayesian") return null;
              const H = Math.max(1, Math.min(52, horizon || 13));
              const n = run.weeks.length;
              const spendRanges = Object.fromEntries(run.channelMeta.map((ch) => {
                const values = (panel.ch?.[ch.key] || []).filter(Number.isFinite);
                const min = values.length ? Math.min(...values) : 0;
                const max = values.length ? Math.max(...values) : 0;
                const requested = futureSpend?.[ch.key]?.[0];
                return [ch.key, { min, max, requested: Number.isFinite(requested) ? requested : null, outOfRange: Number.isFinite(requested) && (requested < min || requested > max) }];
              }));
              const scenarioWarnings = Object.entries(spendRanges)
                .filter(([, range]) => range.outOfRange)
                .map(([key, range]) => ({ key, type: "outside-observed-spend-range", ...range }));
              run.channelMeta.forEach((ch) => {
                const mediaIndex = run.names.indexOf("media_" + ch.key);
                const coefficient = mediaIndex >= 0 ? run.posterior.beta[mediaIndex + 1] : null;
                if (Number.isFinite(coefficient) && coefficient < 0) {
                  scenarioWarnings.push({ key: ch.key, type: "negative-media-effect", coefficient });
                }
              });
              const clampScenario = options.clampScenario !== false;
              const lastWeek = Number(panel.week?.[n - 1]);
              const futureWeeks = Array.from({ length: H }, (_, h) =>
                (Number.isFinite(lastWeek) ? lastWeek : n) + h + 1,
              );
              const state = {};
              run.channelMeta.forEach((ch) => {
                const p = run.params[ch.key];
                state[ch.key] = mmmAdstock(panel.ch[ch.key], p.alpha).at(-1) || 0;
              });
              const predFut = [];
              const baselineFut = [];
              const mediaContributionFut = [];
              const futureRows = [];
              const lo = [];
              const hi = [];
              const lastRaw = run.rawFeatureHistory?.[n - 1] || [];
              const previousRaw = run.rawFeatureHistory?.[Math.max(0, n - 2)] || lastRaw;
              for (let h = 0; h < H; h++) {
                const rawRow = run.names.map((name, j) => {
                  const seasonal = name.match(/^(sin|cos)_(\d+)$/);
                  if (seasonal) {
                    const period = run.seasonalityPeriods?.[Number(seasonal[2])];
                    const angle = period > 0 ? (2 * Math.PI * futureWeeks[h]) / period : 0;
                    return seasonal[1] === "sin" ? Math.sin(angle) : Math.cos(angle);
                  }
                  if (name === "trend") {
                    const delta = (lastRaw[j] || 0) - (previousRaw[j] || 0);
                    // A one-week shock must not be extrapolated linearly for 12
                    // weeks. Damp the continuation; callers can set 0 to hold
                    // the last trend value or 1 for the legacy behavior.
                    const damping = Number.isFinite(options.trendDamping) ? Math.max(0, Math.min(1, options.trendDamping)) : 0.25;
                    return (lastRaw[j] || 0) + delta * (h + 1) * damping;
                  }
                  // 미래 이벤트는 사용자가 별도 시나리오를 주지 않는 한 0. 구조변화
                  // step은 마지막 상태가 지속된다고 가정한다.
                  if (name.startsWith("d_")) {
                    const key = name.slice(2);
                    return options.futureDummy?.[key]?.[h] ?? 0;
                  }
                  // lny/chuseok are lunar-holiday dummies, not lagged outcomes.
                  // Unknown future holiday dates must default to OFF.
                  if (name === "lny" || name === "chuseok") return options.futureDummy?.[name]?.[h] ?? 0;
                  if (options.futureSteps?.[name]) return options.futureSteps[name][h] ?? (lastRaw[j] || 0);
                  if (name.startsWith("industry_")) {
                    const key = name.slice("industry_".length);
                    const supplied = options.futureExternal?.[key]?.[h];
                    if (Number.isFinite(supplied)) {
                      const transformed = _mmmExternalIndexValue(supplied, run.externalTransforms?.[key]);
                      return Number.isFinite(transformed) ? transformed : (lastRaw[j] || 0);
                    }
                    return lastRaw[j] || 0;
                  }
                  return lastRaw[j] || 0;
                });
                run.channelMeta.forEach((ch) => {
                  const p = run.params[ch.key];
                  const requestedSpend = futureSpend?.[ch.key]?.[h] ?? run.saturationByChannel[ch.key].recentMean;
                  const range = spendRanges[ch.key];
                  const spend = clampScenario && range
                    ? Math.min(range.max, Math.max(range.min, requestedSpend || 0))
                    : requestedSpend;
                  state[ch.key] = Math.max(0, spend || 0) + p.alpha * state[ch.key];
                  const j = run.names.indexOf("media_" + ch.key);
                  rawRow[j] = mmmHill(state[ch.key], p.ec, p.slope);
                });
                const row = [1, ...rawRow.map((value, j) => (value - run.featureMeans[j]) / run.featureScales[j])];
                const prediction = run.posterior.beta.reduce((sum, beta, j) => sum + beta * row[j], 0);
                const noMediaRow = rawRow.slice();
                run.channelMeta.forEach((ch) => {
                  const mediaIndex = run.names.indexOf("media_" + ch.key);
                  if (mediaIndex >= 0) noMediaRow[mediaIndex] = 0;
                });
                const baselineRow = [1, ...noMediaRow.map((value, j) => (value - run.featureMeans[j]) / run.featureScales[j])];
                const baseline = Math.max(0, run.posterior.beta.reduce((sum, beta, j) => sum + beta * baselineRow[j], 0));
                baselineFut.push(baseline);
                mediaContributionFut.push(prediction - baseline);
                const quad = row.reduce((sum, value, i) =>
                  sum + value * row.reduce((inner, other, j) => inner + run.posterior.XtXinv[i][j] * other, 0),
                0);
                const predictionSd = Math.sqrt(Math.max(0, run.posterior.sigma2 * (1 + quad)));
                futureRows.push(row);
                predFut.push(prediction);
                const calibrated = mmmApplyIntervalCalibration(
                  prediction,
                  prediction - 1.645 * predictionSd,
                  prediction + 1.645 * predictionSd,
                  run.intervalCalibration,
                );
                lo.push(calibrated.lo);
                hi.push(calibrated.hi);
              }
              let labels = Array.from({ length: H }, (_, i) => `+${i + 1}`);
              if (panel.dates?.length === n && panel.granularity?.days) {
                const lastDate = panel.dates[n - 1];
                if (lastDate instanceof Date && !Number.isNaN(lastDate.getTime())) {
                  labels = Array.from({ length: H }, (_, i) =>
                    _mmmFmtDate(new Date(lastDate.getTime() + (i + 1) * panel.granularity.days * 86400000), panel.granularity),
                  );
                }
              }
              const historicalLabels = panel.dateLabel?.length === n
                ? panel.dateLabel.slice()
                : run.weeks.map((week) => week.week);
              return {
                model: "bayesian",
                isBayesian: true,
                horizon: H,
                sigma: run.posterior.sigma,
                r2: +run.posterior.r2.toFixed(4),
                actual: run.weeks.map((w) => w.actual),
                fittedHist: run.weeks.map((w) => w.fitted),
                predFut,
                lo,
                hi,
                intervalLabel: run.intervalCalibration?.enabled
                  ? "90% predictive reference interval (conditional Gaussian + time-ordered holdout residual calibration)"
                  : "90% conditional Gaussian predictive reference interval (representative transform)",
                intervalCalibration: run.intervalCalibration || null,
                spendRanges,
                scenarioWarnings,
                baselineFut,
                mediaContributionFut,
                histLabels: historicalLabels,
                labels: [...historicalLabels, ...labels],
                futLabels: labels,
                futWeek: futureWeeks,
                futureRows,
                splitAt: n,
                names: run.names,
                beta: run.posterior.beta.slice(1),
                intercept: run.posterior.beta[0],
                chans: run.channelMeta,
                recentMean: Object.fromEntries(
                  run.channelMeta.map((ch) => [ch.key, run.saturationByChannel[ch.key].recentMean]),
                ),
                futSpendByKey: Object.fromEntries(
                  run.channelMeta.map((ch) => [
                    ch.key,
                    Array.from({ length: H }, (_, i) =>
                      (() => {
                        const requested = futureSpend?.[ch.key]?.[i] ?? run.saturationByChannel[ch.key].recentMean;
                        const range = spendRanges[ch.key];
                        return clampScenario && range ? Math.min(range.max, Math.max(range.min, requested || 0)) : requested;
                      })(),
                    ),
                  ]),
                ),
                // 미래 제어 UI도 실제 step 매핑만 노출한다. baseline knot·계절성 같은
                // 내부 feature를 구조 변화로 잘못 표시하지 않는다.
                steps: Object.keys(panel.steps || {})
                  .filter((name) => run.names.includes(name))
                  .map((key) => ({ key, kind: "step", label: key, lastOn: (lastRaw[run.names.indexOf(key)] || 0) > 0.5 })),
              };
            }
