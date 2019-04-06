all:
	tsc --strict --noUnusedLocals --noUnusedParameters --noImplicitReturns game-of-life.ts | strings
