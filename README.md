# mvp: Non-leaky abstraction
[![License](http://img.shields.io/:license-mit-blue.svg)](http://anttiviljami.mit-license.org)

Building blocks for no-code platform.

## App
```
dapr invoke --app-id mvpval --method newthing --data-file sample.json
```

### API: Validation
```
dapr run --app-id mvpval --app-port 3000 --dapr-http-port 3500 node app.js
```

### Persistence

```
dapr run --app-id mvpstate --app-port 3001 --dapr-http-port 3501 node app.js
```

## Comments
### OpenAPI
- Example app built
- Mocks; possible
- Data Generation; possible

### Dapr
- side car for 'serverless' routing, calls based on HTTP request/response
- state machines

### Ngnix
- [Ngnix multi-cast](https://github.com/jefking/Multiplexor)

### Needed
1. Example of working solution; API -> Storage
2. Language to describe wiring (yml)
3. UI for wiring
4. K8s for runtime
5. Logging (Dapr)
6. Canary/Blue-Green deployments

#### Infrastructure
- K8s

## Research
### Dapr
https://github.com/dapr/quickstarts

### API
* [OpenAPI](https://github.com/OAI/OpenAPI-Specification)
* [Pet Store example](https://github.com/OAI/OpenAPI-Specification/blob/main/examples/v3.0/petstore.yaml)

#### Tools
https://openapi.tools/

#### Mock
https://www.npmjs.com/package/openapi-mock-generator