function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function loadAirVantageExport(server, operationId, token) {
  // Clean previous charts if any
  var charts = d3.selectAll(".chart");
  charts.remove();
  // Add loading message
  var chartsDiv = d3.select("#charts");
  chartsDiv.append("div")
    .attr("id", "loading")
    .text("Loading...");

  var url = server + '/api/v1/operations/' + operationId + '/result?access_token=' + token;
  d3.text(url, function(error, _data){
      
    // Various formatters.
    var formatNumber = d3.format(",d"),
      formatChange = d3.format("+,d"),
      formatDate = d3.time.format("%B %d, %Y"),
      formatTime = d3.time.format("%I:%M %p");

    var rows = d3.csv.parseRows(_data);
    var headerLine = 0;
    // Check if it is an historical export on one system or an export multi-system
    if (rows[0][0] === "System name"){
      // Then change line for headers
      headerLine = 3;
    }


    // Row 3 are the keys
    console.log(rows[headerLine]);

    var data = [];
    var model = {};
    // Build a model from keys
    for (var key = 0; key < rows[headerLine].length; key++)
    {
      var name = rows[headerLine][key];
      model[name] = {
        type: "Undefined",
        min: NaN,
        max: NaN,
      };
    }

    // Then iterates on values from row 4
    for (var line = headerLine + 1; line < rows.length; line++)
    {
      var record = {};
      for (var key = 0; key < rows[headerLine].length; key++)
      {
        var name = rows[headerLine][key];
        var value = rows[line][key];
        if (name === "Timestamp") {
          value = new Date(Date.parse(value.substr(0, value.indexOf(' UTC'))));

          model[name].type = "Date";
          if (isNaN(model[name].min) || value < model[name].min)
            model[name].min = value;
          if (isNaN(model[name].max) || value > model[name].max)
            model[name].max = value;
        }
        else if (name === "UID") {
          // Ignore this column
        }
        else if (isNumeric(value)) {
          var numberValue = parseFloat(value);
          value = numberValue;

          model[name].type = "Number";
          if (isNaN(model[name].min) || value < model[name].min)
            model[name].min = value;
          if (isNaN(model[name].max) || value > model[name].max)
            model[name].max = value;
        }
        else if (value != null && value != "") {
          model[name].type = "String";
        }
        record[name] = value;
      }
      data.push(record);
    }

    var crossfilterData = crossfilter(data);
    console.log("Crossfilter size: " + crossfilterData.size());


    var all = crossfilterData.groupAll();

    // Remove loading message
    var loadingMsg = d3.select("#loading");
    loadingMsg.remove();
    // Initialize charts div
    for (var key = 0; key < rows[headerLine].length; key++) {
      var name = rows[headerLine][key];

      if (model[name].type != "Undefined") {
            chartsDiv.append("div")
              .attr("id", "chart" + key)
                .attr("class", "chart")
                .append("div")
                .attr("class", "title")
                .text(name);
      }

      if (model[name].type === "Date") {
        var hour = crossfilterData.dimension(function(d) { return d[name].getHours() + d[name].getMinutes() / 60; }),
          hours = hour.group(Math.floor);

        var barChart  = dc.barChart("#chart" + key); 
        barChart.width(500).height(200)
          .dimension(hour)
          .group(hours)
          .x(d3.scale.linear()
            .domain([0, 24])); 
      }
      else if (model[name].type === "Number") {
        var nbSteps = 20;
        var step = (model[name].max - model[name].min) / nbSteps;
        var numberDim = crossfilterData.dimension(function(d) { return d[name]; }),
          numberGroup = numberDim.group(function(d) { return Math.floor(d / step) * step; });
          
        var barChart  = dc.barChart("#chart" + key); 
        barChart.width(500).height(200)
          .dimension(numberDim)
          .group(numberGroup)
          .x(d3.scale.linear()
            .domain([model[name].min - step, model[name].max + step])); 
      }
      else if (model[name].type === "String")  {
        var stringDim = crossfilterData.dimension(function(d) { return d[name]; }),
          stringGroup = stringDim.group().reduceCount();
          
        var pieChart  = dc.pieChart("#chart" + key); 
        pieChart.width(200).height(200)
          .dimension(stringDim)
          .group(stringGroup); 
      }
    }

    dc.renderAll(); 

  });
}
