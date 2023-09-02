#!/bin/bash
set -e

export SKIP_CONC=1

function setup {
  #npm ci
  npm start -- --detectOpenHandles &> '/dev/null' &
  git clone https://github.com/solid-contrib/solid-crud-tests.git
  cd solid-crud-tests
  git checkout v6.0.0
  npm ci
  cd ..
  git clone https://github.com/solid-contrib/web-access-control-tests.git
  cd  web-access-control-tests
  #git fetch origin
  #git checkout run-against-css
  git pull
  npm ci
  rm run-against-css.sh
  cp ../test/surface/web-access-control-tests.sh run-against-css.sh
  chmod +x run-against-css.sh
  cd ..
}

function runThirdParty {
  git clone https://github.com/solid/node-solid-server
  cd node-solid-server
  docker build -t node-solid-server .

  docker run -d -p 8443:8443 --name server node-solid-server
  cd ..
}

function waitForCss {
  until curl -kI http://localhost:$1 2> /dev/null
  do
    echo Waiting for CSS to start on port $1, this can take up to a minute ...
    sleep 1
  done
}

function waitForNss {
  until curl -kI https://localhost 2> /dev/null
  do
    echo Waiting for NSS to start on port 443, this can take up to a minute ...
    docker logs server
    sleep 1
  done
}

function teardown {
  kill $(lsof -t -i :3000)
  rm -rf solid-crud-tests web-access-control-tests test-suite
  docker stop `docker ps --filter network=testnet -q`
  docker rm `docker ps --filter network=testnet -qa`
  docker network remove testnet
}

function runTests {
  cd $1
  ./run-against-css.sh
  cd ..
}

# ...
teardown || true
setup
waitForCss 3000
#runTests solid-crud-tests
#runThirdParty
#waitForNss
runTests web-access-control-tests
teardown

