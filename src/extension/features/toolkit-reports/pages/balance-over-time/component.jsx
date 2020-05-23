import Highcharts from 'highcharts';
import * as React from 'react';
import * as PropTypes from 'prop-types';
import { formatCurrency } from 'toolkit/extension/utils/currency';
import { FiltersPropType } from 'toolkit-reports/common/components/report-context/component';
import { showTransactionModal } from 'toolkit-reports/utils/show-transaction-modal';
import { LabeledCheckbox } from 'toolkit-reports/common/components/labeled-checkbox';
import { getEntityManager } from 'toolkit/extension/utils/ynab';
import './styles.scss';
/**
 * Component representing the Balance Over Time Report
 */
export class BalanceOverTimeComponent extends React.Component {
  // Define our proptypes for usage of this class
  static propTypes = {
    filters: PropTypes.shape(FiltersPropType).isRequired,
    allReportableTransactions: PropTypes.array.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      shouldGroupAccounts: false,
      isLoading: false,
    };
    this._handleCheckboxClick = this._handleCheckboxClick.bind(this);
  }

  componentDidMount() {
    this._calculateData();
  }

  _getDatesBetween(startDate, endDate) {
    var dates = new Map();

    var currDate = moment(startDate.clone()).startOf('day');
    var lastDate = moment(endDate).startOf('day');

    while (!currDate.isSameOrBefore(lastDate)) {
      console.log(currDate.toDate());
      dates.set(currDate, []);
      currDate.add(1, 'days');
    }

    return dates;
  }

  _calculateData() {
    this.setState({ ...this.state, isLoading: true });
    console.log('Calculating data...');
    const { allReportableTransactions, accountFilterIds, dateFilter } = this.props;

    // Get our first and last months of the budget
    const budgetStart = getEntityManager().getFirstMonthForBudget();
    const budgetEnd = getEntityManager().getLastMonthForBudget();
    let currentDate = budgetStart;

    // Create a map for all dates in between
    let dateToTransactionsMap = this._getDatesBetween(budgetStart, budgetEnd);
    debugger;
    this.setState({ ...this.state, isLoading: false });
  }

  /**
   * Click Handler for our checkbox
   */
  _handleCheckboxClick() {
    this.setState({
      shouldGroupAccounts: !this.state.shouldGroupAccounts,
    });
  }

  /**
   * Render the container for the Chart
   */
  render() {
    if (this.state.isLoading) {
      return <div> Loading... Please wait. </div>;
    }

    return (
      <div className="tk-flex-grow tk-flex tk-flex-column">
        <div className="tk-balance-over-time-group-accounts-checkbox">
          <LabeledCheckbox
            id="tk-group-accounts-checkbox"
            checked={this.state.shouldGroupAccounts}
            label="Group Accounts"
            onChange={this._handleCheckboxClick}
          />
        </div>
        <div className="tk-flex tk-flex-grow">
          <div className="tk-highcharts-report-container" id="tk-balance-over-time-report-graph" />
        </div>
      </div>
    );
  }

  /**
   * Generate the series to be fed into HighCharts
   * @param {Map} dataPointsMap Map of dates in UTC to data
   * @returns {Array} Array containing the HighChart Points
   */
  _dataPointsToHighChartSeries(dataPointsMap) {
    let resultData = [];
    dataPointsMap.forEach((values, date) => {
      resultData.push({
        x: date,
        y: values.runningTotal,
        netChange: values.netChange,
        transactions: values.transactions,
      });
    });
    resultData.sort((datapoint1, datapoint2) => datapoint1.x - datapoint2.x);
    return resultData;
  }

  /**
   * Use the current state to render the chart
   */
  _renderChart() {
    const { series } = this.state;
    if (!series) return;
    // Use the series to attach the data to the chart
    Highcharts.chart('tk-balance-over-time-report-graph', {
      title: { text: 'Balance Over Time' },
      series: series,
      yAxis: {
        title: { text: 'Balance' },
        labels: {
          formatter: e => {
            return formatCurrency(e.value, false);
          },
        },
      },
      xAxis: {
        title: { text: 'Time' },
        type: 'datetime',
        dateTimeLabelFormats: {
          day: '%b %d',
          week: '%b %d, %y',
          month: '%b %Y',
        },
      },
      legend: {
        layout: 'vertical',
        align: 'right',
        verticalAlign: 'middle',
      },
      tooltip: {
        useHTML: true,
        pointFormatter: function() {
          let coloredPoint = `<span style="color:${this.color}">\u25CF</span>`;
          let totalAmount = formatCurrency(this.y, false);
          let netChange = formatCurrency(this.netChange, false);

          let tooltip = `${coloredPoint} ${this.series.name}: <b>${totalAmount}</b><br/>`;
          let color = this.netChange < 0 ? '#ea5439' : '#16a336'; // Red or Green
          tooltip += `${coloredPoint} Net Change: <span style="color: ${color}"><b>${netChange}</b> <br/>`;
          return tooltip;
        },
      },
      plotOptions: {
        line: {
          marker: { enabled: false },
        },
        series: {
          step: true,
          cursor: 'pointer',
          events: {
            click: event => {
              let date = new Date(event.point.x);
              let formattedDate = ynab.YNABSharedLib.dateFormatter.formatDate(date);
              showTransactionModal(formattedDate, event.point.transactions);
            },
            legendItemClick: event => {
              event.preventDefault(); // Prevent toggling via the legend
            },
          },
        },
      },
      responsive: {
        rules: [
          {
            condition: { maxWidth: 500 },
            chartOptions: {
              legend: {
                layout: 'horizontal',
                align: 'center',
                verticalAlign: 'bottom',
              },
            },
          },
        ],
      },
    });
  }
}
