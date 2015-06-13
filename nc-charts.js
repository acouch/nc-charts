if (Meteor.isClient) {
  Router.route('/', function () {
    this.render('nuChartsHome');
  });
  Router.route('/about', function () {
    this.render('nuChartsAbout');
  });
  Router.route('/viz/:_id', {
    data: function() {
      return Models.Viz.findOne(this.params._id);
    },
    template: "nuChartsPage",
  });

  Template.reclineNvd3AppStart.events({
    'click button': function (event, instance) {
    var id = Models.Viz.insert({
       step: 0
     });
     Router.go('/viz/' + id)
    }
  });

  Template.nuChartsPage.events({
  });

  var recline = this.recline;

  Template.reclineNvd3App.onRendered(function() {
    var sharedObject;
    var id = window.location.pathname.split("/viz/").pop();
    var collection = Models.Viz.findOne(id);

    var currentState = collection.state || null;
    console.log(currentState);
    var state;
    var model;

    // There is not saved state. Neither database or memory.
    if(currentState && !sharedObject){
      state = new recline.Model.ObjectState(currentState);
      console.log('wtf');

      model = state.get('model');
      console.log('tf');
      console.log(model);

      if(model && !model.records){
        // Ensure url is protocol agnostic
        model = state.get('model');
        model.url = cleanURL(model.url);
        model = new recline.Model.Dataset(model);

        // Hack: check if the file exists before fetch.
        // CSV.JS does not return an ajax promise then
        // we can't know if the request fails.
        $.get(state.get('model').url)
        .done(function(){
          model.fetch().done(init);
          state.set('model', model);
          state.get('model').queryState.attributes = state.get('queryState');
          sharedObject = {state: state};
        })
        .fail(function(){
          sharedObject = {state: state};
          sharedObject.state.set({step:0});
          init();
        });
      }
    } else if(!sharedObject) {
      state = new recline.Model.ObjectState();
      state.set('queryState', new recline.Model.Query());
      sharedObject = {state: state};
      init();
    }

    function cleanURL(url){
      var haveProtocol = new RegExp('^(?:[a-z]+:)?//', 'i');
      if(haveProtocol.test(url)){
        url = url.replace(haveProtocol, '//');
      }
      return url;
    }

    function save(){
      var currentState = $('#steps input[type="hidden"]').val();
      currentState = $.parseJSON(currentState);
      console.log(currentState);
      console.log(id);
      Models.Viz.update(id, {
        $set: {
          state: currentState 
        }
      });
    }

    function init(){
      var msv = new MultiStageView({
        state: state,
        el: $('#steps')
      });

      msv.addStep(new LoadDataView(sharedObject));
      msv.addStep(new DataOptionsView(sharedObject));
      msv.addStep(new ChooseChartView(sharedObject));
      msv.addStep(new ChartOptionsView(sharedObject));

      msv.on('multistep:change', function(e){
        save();
        console.log('multistep change');
      });
      msv.render();

      sharedObject.state.on('change', function(){
        console.log('state change');
      });

    }

  });

  Template.nuChartsNav.helpers({
    settings: function() {
      return {title: "NC Charts Protosaurus"}
    }
  });
  Template.nuChartsAbout.onRendered(function() {
    Backbone.history.stop();
  });
  Template.nuChartsHome.onRendered(function() {
    Backbone.history.stop();
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
