if (Meteor.isClient) {

  Router.route('/', function () {
    this.render('nuChartsHome');
  });
  Router.route('/about', function () {
    this.render('nuChartsAbout');
  });
  Router.route('/viz/:_id/edit', {
    data: function() {
      return Models.Viz.findOne(this.params._id);
    },
    template: "nuChartsEdit",
  });
  Router.route('/viz/:_id/delete', {
    data: function() {
      return Models.Viz.findOne(this.params._id);
    },
    template: "nuChartsDelete",
  });
  Router.route('/viz/:_id', {
    data: function() {
      return Models.Viz.findOne(this.params._id);
    },
    template: "nuChartsView",
  });

  Template.reclineNvd3AppStart.events({
    'click button.recline-nvd3-app-begin': function (event, instance) {
      Meteor.call('insertViz', function(err, id) {
        Router.go('/viz/' + id + '/edit')
      });
    }
  });

  Template.nuChartsView.events({
    'click button#edit': function (event, instance) {
      Router.go('/viz/' + instance.data._id + '/edit')
    },
    'click button#delete': function (event, instance) {
      Router.go('/viz/' + instance.data._id + '/delete')
    }
  });
  Template.nuChartsEdit.events({
    'click button#view': function (event, instance) {
      Router.go('/viz/' + instance.data._id)
    },
    'click button#delete': function (event, instance) {
      Router.go('/viz/' + instance.data._id + '/delete')
    }
  });
  Template.nuChartsDelete.events({
    'click button#view': function (event, instance) {
      Router.go('/viz/' + instance.data._id)
    },
    'click button#edit': function (event, instance) {
      Router.go('/viz/' + instance.data._id + '/edit')
    },
    'click button#final-delete': function (event, instance) {
      Meteor.call('deleteViz', instance.data._id);
      Router.go('/');
    }
  });

  var recline = this.recline;


  Template.reclineNvd3App.onRendered(function() {

    var sharedObject;
    var id = window.location.pathname.split("/viz/").pop();
    id = id.split("/edit")
    id = id[0]
    var collection = Models.Viz.findOne(id);

    var currentState = collection.state || null;
    var state;
    var model;

    // There is not saved state. Neither database or memory.
    if(currentState && !sharedObject){
      state = new recline.Model.ObjectState(currentState);

      model = state.get('model');

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
      var title = $("input#chart-title").val() || "Untitled";
      var description = $("input#chart-description").val() || "";
      Meteor.call('updateViz', title, description, id, currentState);
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
      msv.addStep(new PublishView(sharedObject));

      msv.on('multistep:change', function(e){
        save();
      });
      msv.render();

      sharedObject.state.on('change', function(e){
        console.log(e.changed.step);
        if(e.changed.step == 4) {
          Router.go('/viz/' + id)
        }
        else if (e.changed.step > 0) {
          $(".panel").remove();
        }
      });

    }

  });

  Template.reclineNvd3AppView.onRendered(function() {
    var id = this.data._id;
    var collection = Models.Viz.findOne(id);
    console.log(collection);
    if (!collection.state || collection.state.step < 3) {
      $("#chart").html("<p>Chart not yet finished. Login and edit to continue.</p>")
      return '';
    }

    var currentState = collection.state || null;

    var state = new recline.Model.ObjectState(currentState);
    state.set('width', window.innerWidth);
    state.set('height', window.innerHeight - 20);

    var model = new recline.Model.Dataset(state.get('model'));
    var title = collection.title;
    model.queryState.attributes.size = 10000000;
    model.fetch().done(function(){
      window.chart = new recline.View.nvd3[state.get('graphType')]({
          model: model,
          state: state,
          el: $('#chart'),
      });
      chart.render();
    });

  });
  Template.nuChartsEdit.helpers({
    step: function() {
     console.log(this);
    }
  });
  Template.chartsList.helpers({
    list: function() {
      var vizs = Models.Viz.find().fetch();
      var charts = [];
      $.each(vizs, function(key, val) {
        if (val.title && val.state.step > 2) {
          charts.push({title: val.title, id: val._id, type: val.state.graphType});
        }
      });
      return charts;
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
  Meteor.methods({
    'insertViz': function() {
      var uid = Meteor.userId();
      check(uid, String);
      var id = Models.Viz.insert({
        uid: uid,
        timestamp: Date.now(),
        step: 0
      });
      return id;
    },
    'deleteViz': function(id) {
      Models.Viz.remove({
        "_id": id
      });
      console.log(id);
      return id;
    },
    'updateViz': function(title, description, id, state) {
      var uid = Meteor.userId();
      check(uid, String);
      check(id, String);
      // TODO: Sanitize state.
      //check(state, {
      //  step: Integer,
      //  model: {
      //    backend: String,
      //    url: String
      //  }
      //});
      Models.Viz.update(id, {
        $set: {
          title: title,
          state: state,
          description: description,
          updated: Date.now(),
          uid: uid
        }
      });
    }
  })
}
