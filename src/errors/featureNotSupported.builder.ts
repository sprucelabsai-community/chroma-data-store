import { buildErrorSchema } from '@sprucelabs/schema'

export default buildErrorSchema({
    id: 'featureNotSupported',
    name: 'Feature not supported',
    fields: {
        operation: {
            type: 'text',
            isRequired: true,
        },
    },
})
