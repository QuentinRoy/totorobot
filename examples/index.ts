import { authMachine, signIn } from './case-studies/auth-machine.ts'
import { nextResults, searchBox } from './case-studies/search-box.ts'
import { trafficLight } from './case-studies/traffic-light.ts'

console.log('--- Traffic light (per-state data) ---')

const traffic = trafficLight.start({ changes: 0 })

// Observation is on the host, never the definition: an imported definition
// stays inert. `*` matches any state, and the unlabelled arrow any input.
traffic.observe('* -> *', (e) => {
	console.log(`  ${e.from.name} -${e.input}> ${e.to.name}`, e.to)
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

console.log('\n--- Search box (the `actions` block owns the effects) ---')

const search = searchBox.start()
search.observe('* -> *', (e) => console.log(`  -> ${e.to.name}`))

// Reporting is the caller's, and `observe` takes the same record `actions`
// does: a bare state key is a residency, and `restart: false` keeps this one
// from firing again on a `typing -type> typing` keystroke.
search.observe('typing', {
	run: (e) => console.log(`  [ping] composing, from "${e.to.query}"`),
	restart: false,
})
search.observe('loading -results> results', (e) =>
	console.log(`  [edge] ${e.to.items.length} hit(s) for "${e.to.query}"`),
)

// Three keystrokes inside the debounce window: the timer restarts each time,
// the one-per-session ping does not.
search.send('type', { text: 't' })
search.send('type', { text: 'to' })
search.send('type', { text: 'tot' })

console.log('  results:', await nextResults(search))
