import { defineMachine, immediate, interpret } from 'totorobot';

QUnit.module('Immediate', hooks => {
  QUnit.test('Will immediately transition', assert => {
    let machine = defineMachine().create('one', ({ state, transition }) => ({
      one: state(
        transition('ping', 'two')
      ),
      two: state(
        immediate('three')
      ),
      three: state()
    }));
    let service = interpret(machine, {});
    service.send({ type: 'ping' });
    assert.equal(service.snapshot.state, 'three');
  });

  QUnit.test('Will not reject state when a guard fails', assert => {
    let machine = defineMachine().create('one', ({ guard, state, transition }) => ({
      one: state(
        transition('ping', 'two')
      ),
      two: state(
        immediate('three', guard(() => false)),
        transition('next', 'three')
      ),
      three: state()
    }));
    let service = interpret(machine, {});
    service.send({ type: 'ping' });
    assert.equal(service.snapshot.state, 'two');
    service.send({ type: 'next' });
    assert.equal(service.snapshot.state, 'three');
  });

  QUnit.test('Can immediately transitions past 2 states', assert => {
    let machine = defineMachine().create('one', ({ state }) => ({
      one: state(
        immediate('two')
      ),
      two: state(
        immediate('three')
      ),
      three: state()
    }));

    let service = interpret(machine, {});
    assert.equal(service.snapshot.state, 'three', 'transitioned to 3');
    assert.ok(service.machine.state.value.final, 'in the final state');
  });
});
