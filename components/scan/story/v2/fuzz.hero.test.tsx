// @vitest-environment jsdom
import {fuzz} from './fuzzCases';

fuzz('stored hero', (name, path) => name === 'rich' && path.startsWith('hero'));
