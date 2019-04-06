all:
	tsc --strict --noImplicitReturns game-of-life.ts | strings
