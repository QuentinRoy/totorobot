import { defineMachine, interpret } from 'totorobot';

QUnit.module('Guards', hooks => {
  QUnit.test('Can prevent changing states', assert => {
    let canProceed = false;
    let machine = defineMachine().create('one', ({ guard, state, transition }) => ({
      one: state(
        transition('ping', 'two', guard(() => canProceed))
      ),
      two: state()
    }));
    let service = interpret(machine, {});
    service.send({ type: 'ping' });
    assert.equal(service.snapshot.state, 'one');
    canProceed = true;
    service.send({ type: 'ping' });
    assert.equal(service.snapshot.state, 'two');
  });

  QUnit.test('If there are multiple guards, any returning false prevents a transition', assert => {
    let machine = defineMachine().create('one', ({ guard, state, transition }) => ({
      one: state(
        transition('ping', 'two',
          guard(() => false),
          guard(() => true)
        )
      ),
      two: state()
    }));
    let service = interpret(machine, {});
    service.send({ type: 'ping' });
    assert.equal(service.snapshot.state, 'one');
  });

  QUnit.test('Guards are passed the event', assert => {
    let machine = defineMachine().create('one', ({ guard, state, transition }) => ({
      one: state(
        transition('ping', 'two',
          guard((ctx, ev) => ev.canProceed)
        )
      ),
      two: state()
    }));
    let service = interpret(machine, {});
    service.send({ type: 'ping' });
    assert.equal(service.snapshot.state, 'one', 'still in the initial state');
    service.send({ type: 'ping', canProceed: true });
    assert.equal(service.snapshot.state, 'two', 'now moved');
  });
});
