import { defineMachine, interpret } from 'totorobot';

QUnit.module('Action', () => {
  QUnit.test('Can be used to do side-effects', assert => {
    let count = 0;
    let orig = {};
    let machine = defineMachine().create('one', ({ action, state, transition }) => ({
      one: state(
        transition('ping', 'two',
          action(() => count++)
        )
      ),
      two: state()
    }));
    let service = interpret(machine, orig);
    service.send({ type: 'ping' });

    assert.equal(service.snapshot.context, orig, 'context stays the same');
    assert.equal(count, 1, 'side-effect performed');
  });
});
