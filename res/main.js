"use strict";

var module = angular.module('kitmods', ['ui.bootstrap', 'ngRoute', 'ngStorage']);

module.config(['$routeProvider', '$locationProvider', '$compileProvider', function($routeProvider, $locationProvider, $compileProvider) {
  //$locationProvider.html5Mode(true); // Remove the '#' from URL.
  $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|blob):/);
  $routeProvider.when('/', {
    controller: 'HomeController',
    templateUrl: 'res/home.html'
  }).when('/plan', {
    controller: 'PlanController',
  templateUrl: 'res/plan.html'
  }).when('/plan/download', {
    controller: 'PlanDownloadController',
  templateUrl: 'res/plandownload.html'
  }).otherwise({
    redirectTo: '/'
  });
}]);

module.factory('handbook', ['$http', function($http) {

  var handbook = {};
  handbook.courses = {};
  handbook.modules = {};
  handbook.specializations = {};

  $http.get('data/handbook.json').
  success(function(data, status, headers, config) {
    handbook.courses = data.courses;
    handbook.modules = data.modules;
    handbook.specializations = data.specializations;
  }).
  error(function() {
    alert("Cannot get handbook from server.");
  });
  
  return handbook;
}]);

module.controller('HeaderController', function($scope, $location) {
  $scope.isRoute = function(path) {
    return $location.path() == path;
  };

  $scope.isRouteOrBelow = function(prefix) {
    return $location.path().startsWith(prefix);
  };
});

module.controller('HomeController', function($scope, handbook) {
  $scope.handbook = handbook;
  $scope.specIdAsInt = function(entry) {
    return parseInt(entry.$key.substr(3));
  }
});

module.controller('PlanController', function($scope, $modal, $log, $localStorage, $filter, handbook) {
  $scope.specIdAsInt = function(entry) {
    return parseInt(entry.$key.substr(3));
  }

  $scope.moduleList = {};
  function updateModuleList() {
    if($.isEmptyObject(handbook.courses)) {
      return;
    }

    var modules = {};

    function insertModule(moduleId) {
      var module = modules[moduleId];
      if(!module) {
        var moduleData = handbook.modules[moduleId];
        if(!moduleData) {
          console.log('no module for ID "' + moduleId + "'");
          return;
        }
        module = {
          data: moduleData,
          courses: {},
          chosenEcts: 0,
          lowestCourseEcts: Number.MAX_VALUE,
          ectsState: 'low'
        };
        $.each(module.data.courseIds, function(index, courseId) {
          var chosenModule = $scope.planGetChosenModuleForCourse(courseId);
          var courseData = handbook.courses[courseId];
          var course = {
            data: courseData,
            inModule: $scope.plan.moduleForCourses[courseId] === moduleId,
            interesting: false,
            chosenModule: chosenModule,
            inOtherModule: chosenModule && chosenModule !== moduleId
          };
          module.courses[courseId] = course;
          if(course.inModule) {
            module.chosenEcts += course.data.ects;
            if(course.data.ects < module.lowestCourseEcts) {
              module.lowestCourseEcts = course.data.ects;
            }
          }
        });
        if(module.chosenEcts >= module.data.ects) {
          module.ectsState = 'satisfied';
          if(module.chosenEcts - module.lowestCourseEcts >= module.data.ects) {
            module.ectsState = 'overflow';
          }
        }
        modules[moduleId] = module;
      }

      return module;
    }

    function insertModulesForInterestingCourse(index, interestingCourseId) {
      var interestingCourseData = handbook.courses[interestingCourseId];
      if(!interestingCourseData) {
        console.log('no course for ID "' + interestingCourseId + '"');
        return;
      }

      var chosenModule = $scope.planGetChosenModuleForCourse(interestingCourseId);
      $.each(interestingCourseData.moduleIds, function(index, moduleId) {
        // do not display module just because it has an interesting
        // course that was already placed into another module.
        if(chosenModule && chosenModule !== moduleId) {
          return;
        }

        var module = insertModule(moduleId);
        if(module) {
          var interestingCourse = module.courses[interestingCourseData.id];
          if(interestingCourse) {
            interestingCourse.interesting = true;
          }
        }
      });
    }

    // add modules for courses explicitly marked as interesting:
    $.each($scope.plan.interestingCourses, insertModulesForInterestingCourse);

    // add modules from which a course has already been selected:
    $.each($scope.plan.moduleForCourses, function(courseId, moduleId) {
      var module = insertModule(moduleId);
      if(module) {
        var interestingCourse = module.courses[courseId];
        if(interestingCourse) {
          interestingCourse.interesting = true;
        }
      }
    });

    $.each($scope.plan.specializationForModules, function(moduleId, specId) {
      insertModule(moduleId);
    });

    $scope.moduleList = modules;

    $scope.overviewSpecializations = [];

    $scope.selectedSpecs = [];
    var sortedSpecs = $filter('orderDictBy')(handbook.specializations, $scope.specIdAsInt);
    $.each(sortedSpecs, function(specIdx, spec) {
      var specStats = {
        spec: spec,
        modules: [],
        chosenEcts: 0,
        ectsFromCompleteModules: 0
      }

      $.each(spec.moduleIds, function(moduleIdx, moduleId) {
        var module = handbook.modules[moduleId];
        var modStats = modules[moduleId];
        var modSpec = $scope.plan.specializationForModules[moduleId];

        var overviewModStats = {
          moduleId: moduleId,
          module: module,
          isInteresting: (!!modStats) && modStats.chosenEcts > 0,
          inSpecialization: (!!modSpec) && modSpec === spec.id,
          inOtherSpecialization: (!!modSpec) && modSpec !== spec.id
        };

        if(modStats && modStats.chosenEcts > 0 && !overviewModStats.inOtherSpecialization) {
          specStats.chosenEcts += modStats.chosenEcts;
          if(modStats.ectsState !== 'low') {
            specStats.ectsFromCompleteModules += modStats.data.ects;
          }
        }

        specStats.modules.push(overviewModStats);
      });

      specStats.isInteresting = specStats.chosenEcts > 0;

      if(specStats.ectsFromCompleteModules >= 15 && $scope.selectedSpecs.length < 2) {
        $scope.selectedSpecs.push({
          spec: specStats.spec,
          ects: specStats.ectsFromCompleteModules
        });
      }

      $scope.overviewSpecializations.push(specStats);
    });

    while($scope.selectedSpecs.length < 2) {
      $scope.selectedSpecs.push({
        spec: null,
        ects: 0
      });
    }

    var vfOverhead = 0;
    $.each($scope.selectedSpecs, function(specIdx, spec) {
      if(spec.ects > 15) {
        vfOverhead += spec.ects - 15;
      }
    });
    

    $scope.ectsInFree = 0;
    $scope.maxEctsInFree = 39 - vfOverhead
    
    var totalEcts = 0;
    $.each(modules, function(moduleId, module) {
      totalEcts += module.chosenEcts;
      if(!$scope.plan.specializationForModules[moduleId]) {
        $scope.ectsInFree += module.chosenEcts;
      }
    });
    $scope.totalEcts = totalEcts;

    $scope.ectsPraktika = 0;
    $.each($scope.plan.praktika, function(idx, praktikum) {
      $scope.ectsPraktika += praktikum.ects;
    });
  }
  $scope.$watch('handbook.courses', updateModuleList);
  $scope.$watch('plan.interestingCourses', updateModuleList);

  $scope.courseInModuleChanged = function(course, module) {
    if(course.inModule) {
      $scope.plan.moduleForCourses[course.data.id] = module.data.id;
    } else {
      delete $scope.plan.moduleForCourses[course.data.id];
    }

    updateModuleList();
  }

  $scope.moduleInSpecializationChanged = function(module, specialization) {
    if(module.inSpecialization) {
      $scope.plan.specializationForModules[module.module.id] = specialization.spec.id;
    } else {
      delete $scope.plan.specializationForModules[module.module.id];
    }

    updateModuleList();
  } 

  $scope.handbook = handbook;
  if($localStorage.plan) {
    $scope.plan = $localStorage.plan;
  } else {
    $scope.plan = {
      interestingCourses: ['24114', '24619'],
      moduleForCourses: {'24114': 'IN4INADTP', '24619': 'IN4INAKR'},
    };
  }
  if(!$scope.plan.praktika) {
    $scope.plan.praktika = [];
  }
  if(!$scope.plan.specializationForModules) {
    $scope.plan.specializationForModules = {};
  }

  $localStorage.plan = $scope.plan;

  $scope.planGetChosenModuleForCourse = function(courseId) {
    return $scope.plan.moduleForCourses[courseId];
  };

  $scope.rmInterestingCourse = function(courseId) {
    $scope.plan.interestingCourses.splice($scope.plan.interestingCourses.indexOf(courseId), 1);
    updateModuleList();
  }

  $scope.beginAddInterestingCourse = function() {
    var modalInstance = $modal.open({
      templateUrl: 'myModalContent.html',
      controller: 'PlanControllerAddCurseModal',
      size: 'lg',
      resolve: {
        test: function () {
          return "test";
        }
      }
    });

    modalInstance.result.then(function (item) {
      $log.info('adding (' + item.id + ', ' + item.name + ')');
      $scope.plan.interestingCourses.push(item.id);
      updateModuleList();
    }, function () {
      $log.info('Modal dismissed at: ' + new Date());
    });
  };

  $scope.addPraktikum = function(name, ects) {
    $scope.plan.praktika.push({
      name: name,
      ects: ects
    });
    updateModuleList();
  };
});

module.filter('orderDictBy', function() {
  // re: https://github.com/angular/angular.js/issues/1286#issuecomment-22193332
  return function(obj, fn) {
    var array = [];
    Object.keys(obj).forEach(function(key) {
      obj[key].$key = key;
      array.push(obj[key]);
    });
    array.sort(function (a, b) {
      var va = fn(a);
      var vb = fn(b);

      if(va == vb) {
        return 0;
      } else if (va < vb) {
        return -1;
      } else {
        return 1;
      }
    });
    return array;
  };
});

module.controller('PlanControllerAddCurseModal', function($scope, $modalInstance, $log, handbook) {
  $scope.curCoursesToAdd = [];
  $scope.nameWithCourseIdList = [];
  function updateNameWithCourseIdList() {
    $scope.nameWithCourseIdList = Object.keys(handbook.courses).map(function(key) {
      return {"id" : key, "name" : handbook.courses[key].name };
    });
  };
  $scope.$watch('handbook.courses', updateNameWithCourseIdList);

  $scope.addNewInterestingCourse = function(item) {
    $modalInstance.close(item);
  };

  $scope.finishAddInterestingCourse = function () {
    $modalInstance.close();
    $scope.curCoursesToAdd = [];
  };

  $scope.abortAddInterestingCourse = function () {
    $modalInstance.close();
    $scope.curCoursesToAdd = [];
  };
});

module.controller('PlanDownloadController', function($scope, $log, $localStorage) {
  function updateDownloadPart() {
    $scope.planJson = JSON.stringify($localStorage.plan, null, 4);
    var blob = new Blob([ $scope.planJson ], { type : 'text/plain' });
    $scope.planJsonDownloadUrl = window.URL.createObjectURL(blob);
  }

  updateDownloadPart();

  $scope.uploadPlanJson = function() {
    $scope.uploadState = null;
    $scope.uploadFeedbackMessage = null;

    try {
      var newPlan = JSON.parse($scope.newPlanJson);
      
      $localStorage.plan = newPlan;
      updateDownloadPart();

      $scope.uploadState = 'success';
      $scope.uploadFeedbackMessage = 'Plan successfully uploaded.';
    } catch(e) {
      $scope.uploadState = 'error';
      $scope.uploadFeedbackMessage = 'Not a valid JSON object.';
    }
  }

  $scope.fileSelected = function(evt) {
    $scope.$apply(function() {
      $scope.uploadState = null;
      $scope.uploadFeedbackMessage = null;

      var file = evt.target.files[0];

      if(file.size > 10000) {
        $scope.uploadState = 'error';
        $scope.uploadFeedbackMessage = 'No files above 10 kB supported.';
      } else {
        var reader = new FileReader();

        reader.onload = function(e) {
          $scope.$apply(function() {
            $scope.newPlanJson = e.target.result;
          });
        };

        reader.readAsText(file);
      }
    });
  }

  document.getElementById('jsonFileUpload').addEventListener('change', $scope.fileSelected, false);
});

