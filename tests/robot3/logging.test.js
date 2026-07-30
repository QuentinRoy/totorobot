import { createMachine, interpret, state, transition, reduce, d} from 'totorobot';
import { describe, expect, test } from 'vitest';

describe('robot/logging', () => {
  test('Calls the onEnter function if the state is changed', () => {
    const machine = createMachine({
      one: state(
        transition('go', 'two', reduce((ctx) => (
          { ...ctx, x: 1 }
        )))
      ),
      two: state()
    }, () => ({x: 0, y: 0}));

    const service = interpret(machine, () => {});
    const enterFN = (m, to, state, prevState, event) => {
      expect.soft(m, 'Machines equal').toEqual(machine);
      expect.soft(state, 'Changed state passed.').toEqual({x:1, y:0})
      expect.soft(prevState, 'Previous state passed.').toEqual({x:0, y:0})
      // Preserve QUnit assert.equal's loose equality semantics.
      expect.soft(to == 'two', 'To state passed.').toBe(true)
      // Preserve QUnit assert.equal's loose equality semantics.
      expect.soft(event == 'go', 'Send event passed.').toBe(true)
    }

    d._onEnter = enterFN;

    service.send('go');
  });
});
