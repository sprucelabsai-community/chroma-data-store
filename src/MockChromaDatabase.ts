import { NeDbDatabase } from '@sprucelabs/data-stores'
import { assert } from '@sprucelabs/test-utils'

export default class MockChromaDatabase extends NeDbDatabase {
    private connectionString: string
    public constructor(connectionString: string) {
        super()
        this.connectionString = connectionString
    }

    public assertConnectionStringEquals(connectionString: string) {
        assert.isEqual(
            this.connectionString,
            connectionString,
            'The connection string you passed to your ChromaDb does not equal what I expected!'
        )
    }
}
