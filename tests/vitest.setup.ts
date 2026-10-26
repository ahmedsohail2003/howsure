// Pin the time zone so day labels and local-time checks don't depend on the machine
// (spec.md > Where It Runs and How Someone Tries It; spec.md > Clock).
process.env.TZ = 'America/Toronto'
