# OpenAPI Backend Simple Express Example
[![License](http://img.shields.io/:license-mit-blue.svg)](http://anttiviljami.mit-license.org)

Example project using [openapi-backend](https://github.com/anttiviljami/openapi-backend) on [Express](https://expressjs.com/)

## QuickStart

```
docker build .
docker run -t -p 8080:9000
```

Try the endpoints:

```bash
curl -i http://localhost:9000/pets
curl -i http://localhost:9000/pets/1
```

