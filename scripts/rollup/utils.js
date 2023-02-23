import path from 'node:path';
import fs from 'node:fs';
import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';

const pkgPath = path.resolve(__dirname, '../../packages');
const distPath = path.resolve(__dirname, '../../dist/node_modules');

export const resolvePkgPath = (pkgName, isDist) => {
	if (isDist) return `${distPath}/${pkgName}`;
	return `${pkgPath}/${pkgName}`;
};

export const getPackageJSON = (pkgName) => {
	const path = `${resolvePkgPath(pkgName)}/package.json`;
	const str = fs.readFileSync(path, { encoding: 'utf-8' });
	return JSON.parse(str);
};

export const getBaseRollupPlugins = ({ alias = { __DEV__: true, preventAssignment: true }, tsConfig = {} } = {}) => {
	return [replace(alias), commonjs(), typescript(tsConfig)];
};
