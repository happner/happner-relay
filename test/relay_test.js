objective('Relay', function() {

  before(function() {
    mock('GroupConfig',  require('./_group_config').config);
    mock('PersonConfig', require('./_person_config').config);
    mock('Promise', require('bluebird'));
    mock('expect', require('chai').expect);
    mock('request', require('bluebird').promisifyAll(require('request')))
  });


  context('calls server.createRelayConnected() if datalayer connectable', function() {

    before(function(done, Promise, happner, GroupConfig, PersonConfig) {
      this.timeout(20000);
      Promise.all([
        happner.create(GroupConfig(1)),
        happner.create(PersonConfig(1, 1)),
        happner.create(PersonConfig(2, 1)),
        happner.create(PersonConfig(3, 1)),
      ])
      .spread(function(group1, person1, person2, person3) {
        mock('group1', group1);
        mock('person1', person1);
        mock('person2', person2);
        mock('person3', person3);
        mock('relay1', group1._mesh.elements.relay.module.instance);
      })
      .then(done)./*catch(done)*/catch(function(e) {
        if (! e instanceof Error) {
          console.log('ERROR1', e); // <----------------------------------- TODO: getting errors that are not instanceof Error out of happn/happner, eradicate this behaviour.
          return done(new Error());
        }
        done(e);
      });
    });

    after(function(done, Promise, group1, person1, person2, person3) {
      Promise.all([
        group1.stop(),
        person1.stop(),
        person2.stop(),
        person3.stop(),
      ]).then(done).catch(done);
    });


      
    it('makes new connection',

      function(done, /* Relay, */ Server, relay1, group1, person1, expect) {

        // var relay;
        // mock(Relay.prototype).spy(
        //   function createServer($happn) { // TODO: objective_dev: can't mock on function using injection
        //     relay = this;
        //   }
        // );

        var $happn = person1._mesh.elements.thing1.component.instance; // as injected

        var relaySpec1 = {
          target: $happn.info.datalayer.address,
          component: {
            name: 'person1_thing1',
            description: $happn.description,
          }
        }

        // expect 1 call the createRelayConnected()

        mock(Server.prototype).does(function createRelayConnected(happn, connection, relaySpec, callback) {callback()});

        // expect 1 call to addConnection

        relay1.does(
          function addConnection() {
            mock.original.apply(this, arguments);
          }
        );

        // person initiates relay of his/her private thing

        person1.exchange.group1.relay.createServer(relaySpec1)

        .then(function() {
          expect(Object.keys(   relay1.connections   )).to.eql(['127.0.0.1:20001']);
        })

        .then(done).catch(done);
      }
    );

    it('makes two relays with one connection on concurrent call to relay',

      function(done, Promise, Server, relay1, group1, person2) {

        var $happn1 = person2._mesh.elements.thing1.component.instance;
        var $happn2 = person2._mesh.elements.thing2.component.instance;

        var relaySpec1 = {
          target: $happn1.info.datalayer.address,
          component: {
            name: 'person2_thing1',
            description: $happn1.description,
          }
        };
        var relaySpec2 = {
          target: $happn2.info.datalayer.address,
          component: {
            name: 'person2_thing2',
            description: $happn2.description,
          }
        };

        // expect 2 calls to createRelayConnected()

        mock(Server.prototype).does(
          function createRelayConnected(happn, connection, relaySpec, callback) {callback()},
          function createRelayConnected(happn, connection, relaySpec, callback) {callback()}
        );

        // expect 1 call to addConnection

        relay1.does(
          function addConnection() {
            mock.original.apply(this, arguments);
          }
        );

        Promise.all([
          person2.exchange.group1.relay.createServer(relaySpec1),
          person2.exchange.group1.relay.createServer(relaySpec2),
        ])

        .then(done).catch(done);
      }
    );

    it('uses existing connection',

      function(done, Server, relay1, group1, person3) {

        var $happn1 = person3._mesh.elements.thing1.component.instance;
        var $happn2 = person3._mesh.elements.thing2.component.instance;

        var relaySpec1 = {
          target: $happn1.info.datalayer.address,
          component: {
            name: 'person3_thing1',
            description: $happn1.description,
          }
        };
        var relaySpec2 = {
          target: $happn2.info.datalayer.address,
          component: {
            name: 'person3_thing2',
            description: $happn2.description,
          }
        };

        // expect 1 call to createRelayConnected

        mock(Server.prototype).does(
          function createRelayConnected(happn, connection, relaySpec, callback) {callback()}
        );

        person3.exchange.group1.relay.createServer(relaySpec1)

        .then(function() {

          // expect 1 call to createRelayConnected

          mock(Server.prototype).does(
            function createRelayConnected(happn, connection, relaySpec, callback) {callback()}
          );

          // expct no calls to addConnection

          relay1.spy(
            function addConnection() {
              throw new Error('called addConnection');
            }
          );

          return person3.exchange.group1.relay.createServer(relaySpec2)

        })

        .then(done).catch(done);
      }
    );

    it('uses existing endpoint');

    it('► Create and use a relayed component over datalayer connection',

      function(done, happner, GroupConfig, PersonConfig, expect, request) {

        this.timeout(5000);

        var group0;
        var person0;
        var $happn;

        var createdKey;

        happner.create(GroupConfig(0)) // Create mesh node called group0

        .then(function(group) {
          group0 = group;
          return happner.create(PersonConfig(0, 0)); // Create mesh node called person0
        })

        .then(function(person) {
          person0 = person;
          $happn = person0._mesh.elements.thing1.component.instance;
          return person0.exchange.group0.relay.createServer({
            target: $happn.info.datalayer.address,
            component: {
              name: 'relay_person0_thing1', // <--------------------------
              description: $happn.description
            }
          });
        })

        .then(function(key) {

          createdKey = key; // for destroying

          // Call through relay to person0/thing1/exchangeMethod()

          return group0.exchange.relay_person0_thing1.exchangeMethod({opt:'ions'});

        })

        .then(function(result) {

          expect(result).to.eql({
            opt: 'ions',
            ReplyFrom: 'person0.thing1'
          });

        })

        .then(function() {

          // call to webmethod (only fully supports GET for now)

          return request.getAsync('http://localhost:10000/relay_person0_thing1/method/moo/ook')

        })

        .then(function(result) {

          expect(result[0].body).to.equal('reply for GET from person0.thing1.webMethod() with /moo/ook');

        })

        .then(function() {

          // test for relayed events from remote

          return new Promise(function(resolve, reject) {

            var results = [];

            Promise.all([

              // subscribe to multiple on the 'relaying' component, including wildcarders

              group0.event.relay_person0_thing1.onAsync('event1', function(data, meta) {
                results.push({
                  path: meta.path,
                  data: data.data
                });
              }),
              group0.event.relay_person0_thing1.onAsync('event2/1', function(data, meta) {
                results.push({
                  path: meta.path,
                  data: data.data
                });
              }),
              group0.event.relay_person0_thing1.onAsync('event2/2', function(data, meta) {
                results.push({
                  path: meta.path,
                  data: data.data
                });
              }),
              group0.event.relay_person0_thing1.onAsync('event2/*', function(data, meta) {
                results.push({
                  path: meta.path,
                  data: data.data
                });
              }),
              group0.event.relay_person0_thing1.onAsync('done', function(data, meta) {
                results.push({
                  path: meta.path,
                  data: data.data
                });
                try {
                  expect(results).to.eql([
                    {
                      "path": "/events/group0/relay_person0_thing1/event1",
                      "data": "EVENT1"
                    },
                    {
                      "path": "/events/group0/relay_person0_thing1/event2/1",
                      "data": "EVENT2/1"
                    },
                    {
                      "path": "/events/group0/relay_person0_thing1/event2/1",
                      "data": "EVENT2/1"
                    },
                    {
                      "path": "/events/group0/relay_person0_thing1/event2/2",
                      "data": "EVENT2/2"
                    },
                    {
                      "path": "/events/group0/relay_person0_thing1/event2/2",
                      "data": "EVENT2/2"
                    },
                    {
                      "path": "/events/group0/relay_person0_thing1/done",
                      "data": "DONE"
                    }
                  ]);
                } catch (e) {
                  return reject(e);
                }
                resolve();
              }),

            ])

            .then(function(){

              // Ready for events, emit from the 'relayed' component

              var $happn = person0._mesh.elements.thing1.component.instance;

              $happn.emit('event1', {data: 'EVENT1'});
              $happn.emit('event2/1', {data: 'EVENT2/1'});
              $happn.emit('event2/2', {data: 'EVENT2/2'});
              $happn.emit('done', {data: 'DONE'});

            })

            .catch(reject)
          })

        })

        .then(function() {

          // remove the relay

          return person0.exchange.group0.relay.destroyServer(createdKey)

        })

        .then(done).catch(done);
      }
    );

    

  });


  context('calls server.createRelayEvented() if no connection is possible/available', function() {

    before(function(done, Promise, happner, GroupConfig, PersonConfig) {
      this.timeout(2000);
      Promise.all([
        happner.create(GroupConfig(2)),
        happner.create(PersonConfig(4, 2)),
        happner.create(PersonConfig(5, 2)),
        // happner.create(PersonConfig(6, 2)),
      ])
      .spread(function(group2, person4, person5, person6) {
        mock('group2', group2);
        mock('person4', person4);
        mock('person5', person5);
        mock('person6', person6);
        mock('relay2', group2._mesh.elements.relay.module.instance);
      })
      .then(done)./*catch(done)*/catch(function(e) {
        if (! e instanceof Error) {
          console.log('ERROR1', e);
          return done(new Error());
        }
        done(e);
      });
    });

    after(function(done, Promise, group2, person4, person5, person6) {
      Promise.all([
        group2.stop(),
        person4.stop(),
        person5.stop(),
        // person6.stop(),
      ]).then(done).catch(done);
    });

    it('first attempts connection if target provided', 

      function(done, Server, relay2, group2, person4) {


        var $happn = person4._mesh.elements.thing1.component.instance;

        var unaccessable = $happn.info.datalayer.address;
        unaccessable.port = 44444; // not listening

        var relaySpec = {
          target: unaccessable,
          component: {
            name: 'person4_thing1',
            description: $happn.description,
          }
        };

        mock(Server.prototype).does(
          function createRelayEvented(happn, relaySpec, callback) {callback()}
        );

        person4.exchange.group2.relay.createServer(relaySpec)

        .then(done).catch(done);

      }
    );

    it('attempts no connection if no target provided',

      function(done, Server, relay2, group2, person5) {

        var $happn = person5._mesh.elements.thing1.component.instance;

        var relaySpec = {
          // target: $happn.info.datalayer.address,
          component: {
            name: 'person5_thing1',
            description: $happn.description,
          }
        };

        mock(Server.prototype).does(
          function createRelayEvented(happn, relaySpec, callback) {callback()}
        );

        person5.exchange.group2.relay.createServer(relaySpec)

        .then(done).catch(done);

      }
    );

    xit('► Create and use a relayed component over "reverse" event api', function() {
      throw Pending;
    });

  });

});
