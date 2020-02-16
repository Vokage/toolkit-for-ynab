import Highcharts from 'highcharts';
import * as React from 'react';
import * as PropTypes from 'prop-types';
import { formatCurrency } from 'toolkit/extension/utils/currency';
import { FiltersPropType } from 'toolkit-reports/common/components/report-context/component';
import { showTransactionModal } from 'toolkit-reports/utils/show-transaction-modal';
import { mapAccountsToTransactions, generateDataPointsMap } from './utils';
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
    };
    this._handleCheckboxClick = this._handleCheckboxClick.bind(this);
  }

  /**
   * Prepare our data by mapping generating all our datapoints
   */
  componentWillMount() {
    if (this.props.filters && this.props.allReportableTransactions) {
      this._calculateData(this.props.allReportableTransactions);
      this._updateCurrentDataSet();
    }
  }

  /**
   * When we first render, update our data set
   */
  componentDidMount() {
    this._updateCurrentDataSet();
  }

  /**
   * Update the state if the filters or transactions have changed
   * @param {*} prevProps The previous props used to compare against
   */
  componentDidUpdate(prevProps, prevState) {
    // Recalculate our data if new transactions were reported
    if (this.props.allReportableTransactions !== prevProps.allReportableTransactions) {
      this._calculateData(this.props.allReportableTransactions);
      this._updateCurrentDataSet();
    } else if (
      this.props.filters !== prevProps.filters ||
      this.state.shouldGroupAccounts !== prevState.shouldGroupAccounts
    ) {
      this._updateCurrentDataSet();
    }
  }

  /**
   * Given a transactions list, update the state by recalculating the datapoints
   * Updates the state to the reflect the new data points
   * @param {*} transactions The transactions to use
   */
  _calculateData(transactions) {
    if (!transactions || transactions.length === 0) return;

    // Sort our transactions by date
    let sortedTransactions = transactions.sort(
      (t1, t2) => t1.date.getUTCTime() - t2.date.getUTCTime()
    );

    // Map each account to all their transactions
    let accountToTransactionsMap = mapAccountsToTransactions(sortedTransactions);

    // Generate our datapoints for each account
    let accountToDataPointsMap = new Map();
    accountToTransactionsMap.forEach((transactionsForAcc, accountId) => {
      let datapoints = generateDataPointsMap(transactionsForAcc);
      accountToDataPointsMap.set(accountId, datapoints);
    });

    // Update our state to reflect the datapoints
    this.setState({
      accountToTransactionsMap,
      accountToDataPointsMap,
      sortedTransactions,
    });
  }

  _handleCheckboxClick() {
    this.setState({
      shouldGroupAccounts: !this.state.shouldGroupAccounts,
    });
  }

  /**
   * Render the container for the Chart
   */
  render() {
    return (
      <div>
        <div id="group-checkbox-container">
          <input
            type="checkbox"
            id="group-account-checkbox"
            name="Group Accounts"
            value={this.state.shouldGroupAccounts}
            onClick={this._handleCheckboxClick}
          />
          <span id="group-account-label">Group Accounts</span>
        </div>
        <div
          className="tk-highcharts-report-container"
          id="tk-balance-over-time-report-graph"
        ></div>
      </div>
    );
  }

  /**
   * Use the current filters and data points map to update the data points
   */
  _updateCurrentDataSet() {
    const { filters } = this.props;
    const { accountToDataPointsMap, sortedTransactions } = this.state;
    if (!filters || !accountToDataPointsMap || !sortedTransactions) return;

    const accountFilters = filters.accountFilterIds;
    const { fromDate, toDate } = filters.dateFilter;

    // Filter out the accounts and transactions we don't want to include
    let filteredData = new Map();
    accountToDataPointsMap.forEach((datapoints, accountId) => {
      if (!accountFilters.has(accountId)) {
        let filteredDatapoints = new Map();
        datapoints.forEach((data, dateUTC) => {
          if (dateUTC >= fromDate.getUTCTime() && dateUTC <= toDate.getUTCTime()) {
            filteredDatapoints.set(dateUTC, data);
          }
        });
        filteredData.set(accountId, filteredDatapoints);
      }
    });

    let series = [];

    if (this.state.shouldGroupAccounts) {
      let applicableTransactions = sortedTransactions.filter(transaction => {
        return (
          transaction.date.getUTCTime() >= fromDate.getUTCTime() &&
          transaction.date.getUTCTime() <= toDate.getUTCTime() &&
          !accountFilters.has(transaction.accountId)
        );
      });

      series.push({
        name: 'Grouped Accounts',
        data: this._dataPointsToHighChartSeries(generateDataPointsMap(applicableTransactions)),
      });
    } else {
      filteredData.forEach((datapoints, accountId) => {
        series.push({
          name: getEntityManager().getAccountById(accountId).accountName,
          data: this._dataPointsToHighChartSeries(datapoints),
        });
      });
    }
    console.log(series);
    this.setState(
      {
        filteredData: filteredData,
        series: series,
      },
      this._renderChart
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
