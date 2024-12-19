import { SchemaRegistry } from '@sprucelabs/schema'
import { SpruceErrors } from '../errors.types'



const featureNotSupportedSchema: SpruceErrors.ChromaDataStore.FeatureNotSupportedSchema  = {
	id: 'featureNotSupported',
	namespace: 'ChromaDataStore',
	name: 'Feature not supported',
	    fields: {
	            /** . */
	            'operation': {
	                type: 'text',
	                isRequired: true,
	                options: undefined
	            },
	    }
}

SchemaRegistry.getInstance().trackSchema(featureNotSupportedSchema)

export default featureNotSupportedSchema
