import { authMachine, signIn } from './case-studies/auth-machine.ts'
import { trafficLight } from './case-studies/traffic-light.ts'

console.log('--- Traffic light (per-state data) ---')

const traffic = trafficLight.start({ changes: 0 })

// Observation is on the host, never the definition: an imported definition
// stays inert. `*` matches any state, and the unlabelled arrow any input.
traffic.observe('* -> *', (e) => {
	console.log(`  ${e.from.name} -${e.on}> ${e.to.name}`, e.to)
})
traffic.observe('* -> yellow', () => console.log('    (blinking)'))

traffic.send('next')
traffic.send('next')
traffic.send('next')

console.log('\n--- Auth machine (declining rows + an asynchronous result) ---')

const auth = authMachine.start({ error: null, attempts: 0 })
auth.observe('* -> *', (e) => console.log(`  -> ${e.to.name}`, e.to))

// A blank username: the only row for `login` declines, so nothing happens.
await signIn(auth, { username: '  ', password: 'hunter2' })
console.log('  after a blank username:', auth.current.name)

await signIn(auth, { username: 'quentin', password: 'wrong' })
await signIn(auth, { username: 'quentin', password: 'hunter2' })

// The payoff: `token` is only reachable once the state says we are
// authenticated. No nullable padding on the states that do not have one.
const now = auth.current
if (now.name === 'authenticated') {
	console.log(`\ntoken (typed, no null check needed): ${now.token}`)
}
