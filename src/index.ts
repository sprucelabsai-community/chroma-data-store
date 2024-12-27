export { default as ChromaDatabase } from './ChromaDatabase'
import { DatabaseFactory } from '@sprucelabs/data-stores'
import ChromaDatabase from './ChromaDatabase'
export { default as chromaDbAssert } from './chromaDbAssert.utility'
export { default as MockChromaDatabase } from './MockChromaDatabase'
export * from './ChromaDatabase'

DatabaseFactory.addAdapter('chroma://', ChromaDatabase)
