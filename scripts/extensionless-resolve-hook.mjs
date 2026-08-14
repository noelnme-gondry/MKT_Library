// Node ESM 로더 훅 — 확장자 없는 상대 import(`./responseSubtoolContent`)를 해석한다.
//
// 앱 코드는 Next/Vitest 번들러가 확장자를 붙여주는 전제로 쓰여 있어서, plain node로
// 같은 모듈을 부르면 ERR_MODULE_NOT_FOUND가 난다. 앱 코드를 스크립트 사정에 맞춰
// 고치는 대신(그쪽이 SSOT다) 스크립트 쪽에서 해석 규칙을 맞춘다.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    if (error?.code === "ERR_MODULE_NOT_FOUND" && isRelative && !/\.[a-z]+$/i.test(specifier)) {
      return next(`${specifier}.js`, context);
    }
    throw error;
  }
}
