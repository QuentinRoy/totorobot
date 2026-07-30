import { createMachine, defineMachine, interpret, reduce, state, transition } from 'totorobot';

QUnit.module('Reduce', () => {
  QUnit.test('Basic state change', assert => {
    let machine = createMachine({
      one: state(
        transition('ping', 'two',
          reduce((ctx) => ({ ...ctx, one: 1 })),
          reduce((ctx) => ({ ...ctx, two: 2 }))
        )
      ),
      two: state()
    });
    let service = interpret(machine, () => {});
    service.send('ping');

    let { one, two } = service.context;
    assert.equal(one, 1, 'first reducer ran');
    assert.equal(two, 2, 'second reducer ran');
  });

  QUnit.test('If no reducers, the context remains', assert => {
    let machine = defineMachine().create('one', ({ state, transition }) => ({
      one: state(
        transition('go', 'two')
      ),
      two: state()
    }));

    let service = interpret(machine, { one: 1, two: 2 });
    service.send({ type: 'go' });
    assert.deepEqual(service.snapshot.context, { one: 1, two: 2 }, 'context remains');
  });

  QUnit.test('Event is the second argument', assert => {
    assert.expect(2);

    let machine = defineMachine().create('one', ({ reduce, state, transition }) => ({
      one: state(
        transition('go', 'two',
          reduce(function(ctx, ev) {
            assert.deepEqual(ev, { type: 'go' });
            return { ...ctx, worked: true };
          })
        )
      ),
      two: state()
    }));
    let service = interpret(machine, {});
    service.send({ type: 'go' });
    assert.equal(service.snapshot.context.worked, true, 'changed the context');
  });
});
