queue()
    .defer(d3.csv, "data/Salaries.csv")
    .await(makeGraphs);

function makeGraphs(error, salaryData) {

    //Used to make global crossfilter object of the data
    var ndx = crossfilter(salaryData);

    //converts strings to integers as some of the data from the data file is in string format, which causes issues.

    salaryData.forEach(function(d) {
        d.salary = parseInt(d.salary);
        d.yrs_service = parseInt(d["yrs.service"]); //using in array notation as the column has a . in the name which can cause errors/ renamed the data to yrs_service, which is what is called to access this data basically a variable for data.
        d.yrs_since_phd = parseInt(d["yrs.since.phd"]);
    });

    show_discipline_selector(ndx);

    show_gender_balance(ndx);

    show_average_salary(ndx);

    show_rank_distribution(ndx);

    show_percent_prof(ndx, 'Female', '#percentage-of-women-prof');
    show_percent_prof(ndx, 'Male', '#percentage-of-men-prof');

    service_to_salary(ndx);

    phd_to_salary(ndx);

    dc.renderAll();

}

//Allows users to select different disciplines
function show_discipline_selector(ndx) {
    let dim = ndx.dimension(dc.pluck('discipline'));

    let group = dim.group();

    dc.selectMenu('#discipline-selector')
        .dimension(dim)
        .group(group);
}

//Allows gender to be selected from the crossfilter object
function show_gender_balance(ndx) {
    let dim_sex = ndx.dimension(dc.pluck('sex'));

    let group = dim_sex.group();

    dc.barChart('#gender-balance')
        .width(350)
        .height(250)
        .margins({ top: 10, right: 50, bottom: 30, left: 50 })
        .dimension(dim_sex)
        .group(group)
        .transitionDuration(500)
        .x(d3.scale.ordinal()) //Due to words being in the dimension i.e. male , female
        .xUnits(dc.units.ordinal)
        .xAxisLabel('Gender')
        .yAxis().ticks(20);
};

//Allows genders to be split and then salary to be counted for each entry
function show_average_salary(ndx) {
    var dim_sex = ndx.dimension(dc.pluck('sex'));



    function addItem(p, v) { // P is an accumulator that keeps track of count,average, sum (initialise sets the value of p to be 0 for count etc)
        p.count++;
        p.total += v.salary;
        p.average = p.total / p.count;
        return p;
    }

    function removeItem(p, v) {
        p.count--;
        if (p.count == 0) {
            p.total = 0;
            p.average = 0;
        }
        else {
            p.total += v.salary;
            p.average = p.total / p.count;
        }

        return p
    }

    function initialise() {
        return { count: 0, total: 0, average: 0 }
    }

    var averageSalaryByGender = dim_sex.group().reduce(addItem, removeItem, initialise);

    dc.barChart('#average-salary')
        .width(350)
        .height(250)
        .margins({ top: 10, right: 50, bottom: 30, left: 100 })
        .dimension(dim_sex)
        .group(averageSalaryByGender)
        .valueAccessor(function(d) {
            return d.value.average.toFixed(2); // This will have a value of male.value.average and then female.value.average and will plot both of these values to the chart (toFixed will set the value to 2 decimal place)
        })
        .transitionDuration(500)
        .x(d3.scale.ordinal()) //Due to words being in the dimension i.e. male , female
        .xUnits(dc.units.ordinal)
        .xAxisLabel('Gender')
        .elasticY(true)
        .yAxis().ticks(4); // has to be last methodS


}

//based on gender of entry, the positions held by each gender can be displayed
function show_rank_distribution(ndx) { //stacked bar chart

    var dim_sex = ndx.dimension(dc.pluck('sex'));

    var prof_by_gender = rank_by_gender(dim_sex, 'Prof');
    var asstProf_by_gender = rank_by_gender(dim_sex, 'AsstProf');
    var assocProf_by_gender = rank_by_gender(dim_sex, 'AssocProf');



    function rank_by_gender(dim, rank) {
        return dim.group().reduce(
            //adder
            function(p, v) {
                p.total++;

                if (v.rank == rank) {
                    p.match++;
                }
                return p;
            },

            //remover
            function(p, v) {
                p.total--;

                if (v.rank == rank) {
                    p.match--;
                }
                return p;
            },

            //initialiser
            function() {
                return { total: 0, match: 0 }
            })


    }

    dc.barChart('#rank-distribution')
        .width(350)
        .height(250)
        .dimension(dim_sex)
        .group(prof_by_gender, 'Prof')
        .stack(asstProf_by_gender, 'Assitant Prof')
        .stack(assocProf_by_gender, 'Associate Prof')
        .valueAccessor(function(d) { //This passes each group into the accessor and divides the match value for this group by the total number of entries for either male or female then times 100 to work out the percentage of the total
            if (d.value.total > 0) { //d will = male or female in this case depending on which is passed in first
                return (d.value.match / d.value.total * 100);
            }
        })
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel('Gender')
        .legend(dc.legend().x(260).y(20).itemHeight(15).gap(5))
        .margins({ top: 10, right: 100, bottom: 40, left: 50 });
}

//Professor percentage can be displayed, uses custome reduce function to determine percentage of entries which are professors
function show_percent_prof(ndx, gender, element) {
    var percentProf = ndx.groupAll().reduce(
        function(p, v) {
            if (v.sex === gender) {
                p.count++;
                if (v.rank === 'Prof') {
                    p.areProf++;
                }
            }
            return p
        },

        function(p, v) {
            if (v.sex === gender) {
                p.count--;
                if (v.rank === 'Prof') {
                    p.areProf--;
                }
            }
            return p
        },

        function() {
            return { count: 0, areProf: 0 }

        }
    );

    dc.numberDisplay(element)
        .formatNumber(d3.format('.2%'))
        .valueAccessor(function(d) {
            if (d.count === 0) {
                return 0
            }
            else {
                return (d.areProf / d.count);

            }
        })
        .group(percentProf);
}

//Shows the salary correlation with the length of service
function service_to_salary(ndx) {

    var genderColors = d3.scale.ordinal()
        .domain(['Female', 'Male'])
        .range(['pink', 'blue']);

    var xAxisDomainYears = ndx.dimension(dc.pluck('yrs_service')); //Will help us to identify to minimum and maximum values that we will need to place on the x axis

    var experienceDim = ndx.dimension(function(d) {
        return [d.yrs_service, d.salary, d.sex, d.rank];
    });

    var experienceSalaryGroup = experienceDim.group();

    var minExperience = xAxisDomainYears.bottom(1)[0].yrs_service; //takes the bottom 1 value
    var maxExperience = xAxisDomainYears.top(1)[0].yrs_service;

    dc.scatterPlot('#service-salary')
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minExperience, maxExperience]))
        .brushOn(false)
        .symbolSize(8)
        .clipPadding(10)
        .yAxisLabel('Salary')
        .xAxisLabel('Years of service')
        .title(function(d) {
            return d.key[3] + ' earned: ' + d.key[1];
        })
        .colorAccessor(function(d) {
            return d.key[2]
        })
        .colors(genderColors)
        .dimension(experienceDim)
        .group(experienceSalaryGroup)
        .margins({ top: 10, right: 50, bottom: 75, left: 75 });
}

//Allows the salary to be calculated for all data entries which have a PHD
function phd_to_salary(ndx) {
    
    var genderColors = d3.scale.ordinal()
        .domain(['Female', 'Male'])
        .range(['pink', 'blue']);

    var xAxisDomainYears = ndx.dimension(dc.pluck('yrs_since_phd')); //Will help to identify to minimum and maximum values that we will need to place on the x axis

    var phdDim = ndx.dimension(function(d) {
        return [d.yrs_since_phd, d.salary, d.sex, d.rank];
    });

    var phdSalaryGroup = phdDim.group();

    var minPhd = xAxisDomainYears.bottom(1)[0].yrs_since_phd; //takes the bottom 1 value
    var maxPhd = xAxisDomainYears.top(1)[0].yrs_since_phd;

    dc.scatterPlot('#phd-salary')
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minPhd, maxPhd]))
        .brushOn(false)
        .symbolSize(8)
        .clipPadding(10)
        .yAxisLabel('Salary')
        .xAxisLabel('Years since PhD')
        .title(function(d) {
            return d.key[3] + ' earned: ' + d.key[1];
        })
        .colorAccessor(function(d) {
            return d.key[2]
        })
        .colors(genderColors)
        .dimension(phdDim)
        .group(phdSalaryGroup)
        .margins({ top: 10, right: 50, bottom: 75, left: 75 });

}
