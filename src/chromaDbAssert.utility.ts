import { assertOptions } from '@sprucelabs/schema'
import { assert } from '@sprucelabs/test-utils'
import ChromaDatabase from './ChromaDatabase'

const chromaDbAssert = {
    embeddingFieldsForCollectionEqual(collection: string, fields: string[]) {
        assertOptions(
            {
                collection,
                fields,
            },
            ['collection', 'fields']
        )

        const actual = ChromaDatabase.getEmbeddingsFields()?.[collection]
        assert.isTruthy(
            actual,
            `I could not find any embedding fields for the collection called ${collection}`
        )

        assert.isEqualDeep(
            actual,
            fields,
            `The embedding fields for the collection did not match.`
        )
    },
}

export default chromaDbAssert
