import { interpret } from "../src/totorobot.ts"
import { authMachine } from "./case-studies/auth-machine.ts"
import { trafficLight } from "./case-studies/traffic-light.ts"

console.log("--- Traffic light (per-state context) ---")

const traffic = interpret(trafficLight, { changes: 0 }, (snapshot) => {
	// `snapshot.context` is narrowed by `snapshot.state`: `blinking` only exists on
	// yellow,
	// and reading it in any other branch would not compile.
	const extra =
		snapshot.state === "yellow"
			? ` blinking=${snapshot.context.blinking}`
			: ""
	console.log(
		`  -> ${snapshot.state} (changes: ${snapshot.context.changes})${extra}`,
	)
})

traffic.send({ type: "next" })
traffic.send({ type: "next" })
traffic.send({ type: "next" })

console.log("\n--- Auth machine (typed invoke + typestate) ---")

const auth = interpret(
	authMachine,
	{ error: null, attempts: 0 },
	(snapshot) => {
		console.log(`  -> ${snapshot.state}`, snapshot.context)
	},
)

auth.send({ type: "login", username: "quentin", password: "wrong" })

setTimeout(() => {
	auth.send({ type: "login", username: "quentin", password: "hunter2" })
}, 150)

setTimeout(() => {
	// The payoff: `token` is only reachable once TS knows we're authenticated.
	if (auth.current.state === "authenticated") {
		console.log(
			`\ntoken (typed, no null check needed): ${auth.current.context.token}`,
		)
	}
}, 300)
