// Jest-only stub for @nestjs/typeorm's dist/common/typeorm-compat.js.
//
// @nestjs/typeorm@12.x ships as an ESM-only package ("type": "module") and
// this particular file does `const require = createRequire(import.meta.url)`
// to lazily resolve optional TypeORM v0.3.x exports. When ts-jest transforms
// that file for CommonJS, the local `const require` collides with the
// `require` parameter Jest's CJS module wrapper already injects, producing
// `SyntaxError: Identifier 'require' has already been declared`.
//
// The real file only resolves `Connection`/`AbstractRepository`, both of
// which no longer exist on the TypeORM v1 installed in this service, so this
// stub reproduces the same (undefined) runtime shape without the ESM-specific
// `require` shim.
export const Connection = undefined;
export const AbstractRepository = undefined;
