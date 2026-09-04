// Stub for @nestjs/typeorm's dist/common/typeorm-compat.js.
//
// That file does `const require = createRequire(import.meta.url);` as an ESM
// shim to lazily resolve TypeORM v0.3's legacy `Connection`/`AbstractRepository`
// exports. When ts-jest compiles it to CommonJS, that top-level `const require`
// collides with the `require` parameter Jest's CJS module wrapper already
// injects, throwing "Identifier 'require' has already been declared".
//
// Neither `Connection` nor `AbstractRepository` is used anywhere in this
// codebase (verified: grep finds zero references outside this file), so
// stubbing both to `undefined` reproduces the real file's runtime shape
// with no behavioral difference, and only affects Jest's module resolution
// at test time — it has zero effect on the production build or runtime.
export const Connection = undefined;
export const AbstractRepository = undefined;
