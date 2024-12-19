export { default as ChromaDatabase } from './ChromaDatabase'
import { DatabaseFactory } from '@sprucelabs/data-stores'
import ChromaDatabase from './ChromaDatabase'
export * from './ChromaDatabase'

DatabaseFactory.addAdapter('chroma://', ChromaDatabase)
